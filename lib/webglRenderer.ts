// WebGL2 renderer for ordered/parallelizable dithering algorithms.
// Error diffusion cannot be GPU-accelerated (sequential data dependency).

type RGB = [number, number, number]

// ---- Shaders ----

const VERT = `#version 300 es
in vec2 a_pos;
out vec2 v_uv;
void main() {
  // a_pos is in NDC; v_uv is the letterbox-adjusted UV into the source texture
  v_uv = vec2(a_pos.x * 0.5 + 0.5, 0.5 - a_pos.y * 0.5);
  gl_Position = vec4(a_pos, 0.0, 1.0);
}`

const BAYER_FRAG = `#version 300 es
precision highp float;
in vec2 v_uv;
out vec4 o;
uniform sampler2D u_src;
uniform vec2 u_srcSize;
uniform int u_n;
uniform int u_stride;
uniform int u_scale;
uniform float u_thresh;
uniform int u_palN;
uniform vec3 u_pal[16];
uniform float u_mat[64];
void main() {
  vec3 src = texture(u_src, v_uv).rgb;
  ivec2 px = ivec2(v_uv * u_srcSize);
  int bx = (px.x / u_scale) % u_n;
  int by = (px.y / u_scale) % u_n;
  float t = u_mat[by * u_stride + bx] / float(u_n * u_n) - 0.5 + (u_thresh - 0.5);
  vec3 adj = clamp(src + vec3(t), 0.0, 1.0);
  vec3 best = u_pal[0] / 255.0;
  float bestD = 1e9;
  for (int i = 0; i < 16; i++) {
    if (i >= u_palN) break;
    vec3 c = u_pal[i] / 255.0;
    vec3 d = adj - c;
    float dist = dot(d, d);
    if (dist < bestD) { bestD = dist; best = c; }
  }
  o = vec4(best, 1.0);
}`

const HATCH_FRAG = `#version 300 es
precision highp float;
in vec2 v_uv;
out vec4 o;
uniform sampler2D u_src;
uniform vec2 u_srcSize;
uniform int u_scale;
uniform float u_thresh;
uniform int u_palN;
uniform vec3 u_pal[16];
void main() {
  vec3 src = texture(u_src, v_uv).rgb;
  float lum = dot(src, vec3(0.299, 0.587, 0.114));
  float adj = clamp(lum + (u_thresh - 0.5), 0.0, 1.0);
  ivec2 px = ivec2(v_uv * u_srcSize);
  float s = float(u_scale);
  bool diagA = mod(float(px.x + px.y), s) < 1.0;
  bool diagB = mod(float(px.x - px.y + int(s) * 1000), s) < 1.0;
  bool isBlack;
  if (adj < 0.25) isBlack = diagA || diagB;
  else if (adj < 0.5) isBlack = diagA;
  else if (adj < 0.75) isBlack = mod(float(px.x + px.y), s * 2.0) < 1.0;
  else isBlack = false;
  vec3 color = isBlack ? u_pal[0] / 255.0 : u_pal[u_palN - 1] / 255.0;
  o = vec4(color, 1.0);
}`

const HALFTONE_FRAG = `#version 300 es
precision highp float;
in vec2 v_uv;
out vec4 o;
uniform sampler2D u_src;
uniform vec2 u_srcSize;
uniform float u_scale;
uniform float u_angle;
uniform int u_palN;
uniform vec3 u_pal[16];
void main() {
  float cosA = cos(u_angle);
  float sinA = sin(u_angle);
  vec2 px = v_uv * u_srcSize;
  // Rotate pixel into grid space
  vec2 rot = vec2(px.x * cosA - px.y * sinA, px.x * sinA + px.y * cosA);
  vec2 cellIdx = floor(rot / u_scale);
  // Check 3x3 neighbors so overlapping dots from adjacent cells are included
  bool inDot = false;
  for (int dy = -1; dy <= 1 && !inDot; dy++) {
    for (int dx = -1; dx <= 1 && !inDot; dx++) {
      vec2 nIdx = cellIdx + vec2(dx, dy);
      vec2 nCenter_rot = (nIdx + 0.5) * u_scale;
      // Rotate cell center back to image space
      vec2 nCenter = vec2(nCenter_rot.x * cosA + nCenter_rot.y * sinA,
                          -nCenter_rot.x * sinA + nCenter_rot.y * cosA);
      vec2 nUV = clamp(nCenter / u_srcSize, 0.0, 1.0);
      vec3 nSrc = texture(u_src, nUV).rgb;
      float lum = 1.0 - dot(nSrc, vec3(0.299, 0.587, 0.114));
      float radius = sqrt(lum) * u_scale * 0.5;
      if (length(px - nCenter) <= radius) inDot = true;
    }
  }
  vec3 color = inDot ? u_pal[0] / 255.0 : u_pal[u_palN - 1] / 255.0;
  o = vec4(color, 1.0);
}`

// ---- Bayer matrices (padded to stride matching their size) ----

const BAYER_2 = new Float32Array([0,2, 3,1])
const BAYER_4 = new Float32Array([0,8,2,10, 12,4,14,6, 3,11,1,9, 15,7,13,5])
const BAYER_8 = new Float32Array([
   0,32, 8,40, 2,34,10,42,
  48,16,56,24,50,18,58,26,
  12,44, 4,36,14,46, 6,38,
  60,28,52,20,62,30,54,22,
   3,35,11,43, 1,33, 9,41,
  51,19,59,27,49,17,57,25,
  15,47, 7,39,13,45, 5,37,
  63,31,55,23,61,29,53,21,
])

// ---- Renderer class ----

type AlgorithmId = 'bayer2' | 'bayer4' | 'bayer8' | 'hatch' | 'halftone'

function compile(gl: WebGL2RenderingContext, vert: string, frag: string): WebGLProgram {
  const vs = gl.createShader(gl.VERTEX_SHADER)!
  gl.shaderSource(vs, vert); gl.compileShader(vs)
  if (!gl.getShaderParameter(vs, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(vs)!)

  const fs = gl.createShader(gl.FRAGMENT_SHADER)!
  gl.shaderSource(fs, frag); gl.compileShader(fs)
  if (!gl.getShaderParameter(fs, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(fs)!)

  const prog = gl.createProgram()!
  gl.attachShader(prog, vs); gl.attachShader(prog, fs); gl.linkProgram(prog)
  if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(prog)!)
  return prog
}

export class WebGLRenderer {
  private gl: WebGL2RenderingContext
  private bayerProg: WebGLProgram
  private hatchProg: WebGLProgram
  private halftoneProg: WebGLProgram
  private quadBuf: WebGLBuffer
  private srcTex: WebGLTexture

  constructor(canvas: HTMLCanvasElement) {
    const gl = canvas.getContext('webgl2')
    if (!gl) throw new Error('WebGL2 not supported')
    this.gl = gl

    this.bayerProg    = compile(gl, VERT, BAYER_FRAG)
    this.hatchProg    = compile(gl, VERT, HATCH_FRAG)
    this.halftoneProg = compile(gl, VERT, HALFTONE_FRAG)

    this.quadBuf = gl.createBuffer()!
    gl.bindBuffer(gl.ARRAY_BUFFER, this.quadBuf)
    // Fullscreen quad as triangle strip
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1,-1, 1,-1, -1,1, 1,1]), gl.STATIC_DRAW)

    this.srcTex = gl.createTexture()!
    gl.bindTexture(gl.TEXTURE_2D, this.srcTex)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE)
  }

  render(
    source: HTMLVideoElement | ImageBitmap,
    algorithmId: AlgorithmId,
    palette: RGB[],
    params: Record<string, number | boolean>,
  ) {
    const gl = this.gl
    const canvas = gl.canvas as HTMLCanvasElement

    // Resize canvas to container
    const w = canvas.offsetWidth
    const h = canvas.offsetHeight
    if (canvas.width !== w || canvas.height !== h) {
      canvas.width = w
      canvas.height = h
    }
    gl.viewport(0, 0, w, h)
    gl.clearColor(0.02, 0.02, 0.03, 1)
    gl.clear(gl.COLOR_BUFFER_BIT)

    // Source dimensions
    const srcW = source instanceof HTMLVideoElement
      ? (source.videoWidth || 1) : source.width
    const srcH = source instanceof HTMLVideoElement
      ? (source.videoHeight || 1) : source.height
    if (srcW === 0 || srcH === 0) return

    // Upload source texture
    gl.bindTexture(gl.TEXTURE_2D, this.srcTex)
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, source)

    // Letterbox: compute NDC quad that maintains source aspect ratio
    const srcAspect = srcW / srcH
    const canvasAspect = w / h
    let quadW: number, quadH: number
    if (srcAspect > canvasAspect) {
      quadW = 1; quadH = canvasAspect / srcAspect
    } else {
      quadH = 1; quadW = srcAspect / canvasAspect
    }
    // Update quad geometry for letterboxing
    gl.bindBuffer(gl.ARRAY_BUFFER, this.quadBuf)
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([
      -quadW, -quadH,  quadW, -quadH,
      -quadW,  quadH,  quadW,  quadH,
    ]), gl.DYNAMIC_DRAW)

    // Select program
    let prog: WebGLProgram
    if (algorithmId === 'halftone') prog = this.halftoneProg
    else if (algorithmId === 'hatch') prog = this.hatchProg
    else prog = this.bayerProg

    gl.useProgram(prog)

    // Bind quad
    const aPos = gl.getAttribLocation(prog, 'a_pos')
    gl.enableVertexAttribArray(aPos)
    gl.vertexAttribPointer(aPos, 2, gl.FLOAT, false, 0, 0)

    // Source texture
    gl.uniform1i(gl.getUniformLocation(prog, 'u_src'), 0)
    gl.uniform2f(gl.getUniformLocation(prog, 'u_srcSize'), srcW, srcH)

    // Palette (max 16 colors)
    const palN = Math.min(palette.length, 16)
    gl.uniform1i(gl.getUniformLocation(prog, 'u_palN'), palN)
    const palFlat = new Float32Array(48) // 16 * vec3
    for (let i = 0; i < palN; i++) {
      palFlat[i * 3] = palette[i][0]
      palFlat[i * 3 + 1] = palette[i][1]
      palFlat[i * 3 + 2] = palette[i][2]
    }
    gl.uniform3fv(gl.getUniformLocation(prog, 'u_pal'), palFlat)

    // Algorithm-specific uniforms
    if (algorithmId === 'bayer2' || algorithmId === 'bayer4' || algorithmId === 'bayer8') {
      const [mat, n] = algorithmId === 'bayer2'
        ? [BAYER_2, 2] : algorithmId === 'bayer4'
        ? [BAYER_4, 4] : [BAYER_8, 8]
      const padded = new Float32Array(64)
      padded.set(mat)
      gl.uniform1fv(gl.getUniformLocation(prog, 'u_mat'), padded)
      gl.uniform1i(gl.getUniformLocation(prog, 'u_n'), n)
      gl.uniform1i(gl.getUniformLocation(prog, 'u_stride'), n)
      gl.uniform1i(gl.getUniformLocation(prog, 'u_scale'), params.scale as number || 1)
      gl.uniform1f(gl.getUniformLocation(prog, 'u_thresh'), params.threshold as number ?? 0.5)
    } else if (algorithmId === 'hatch') {
      gl.uniform1i(gl.getUniformLocation(prog, 'u_scale'), params.scale as number || 4)
      gl.uniform1f(gl.getUniformLocation(prog, 'u_thresh'), params.threshold as number ?? 0.5)
    } else if (algorithmId === 'halftone') {
      gl.uniform1f(gl.getUniformLocation(prog, 'u_scale'), params.scale as number || 8)
      gl.uniform1f(gl.getUniformLocation(prog, 'u_angle'), ((params.angle as number) ?? 45) * Math.PI / 180)
    }

    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4)
  }

  dispose() {
    const gl = this.gl
    gl.deleteTexture(this.srcTex)
    gl.deleteBuffer(this.quadBuf)
    ;[this.bayerProg, this.hatchProg, this.halftoneProg].forEach(p => gl.deleteProgram(p))
  }
}

export const WEBGL_ALGORITHMS = new Set(['bayer2', 'bayer4', 'bayer8', 'hatch', 'halftone'])
