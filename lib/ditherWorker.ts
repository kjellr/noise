// ============================================================
// SELF-CONTAINED DITHER WORKER — no imports allowed
// ============================================================

type RGB = [number, number, number]
type AlgorithmId =
  | 'floyd-steinberg' | 'atkinson' | 'stucki' | 'burkes' | 'sierra'
  | 'bayer2' | 'bayer4' | 'bayer8' | 'hatch' | 'halftone' | 'riemersma'

interface DitherRequest {
  id: number
  imageData: ImageData
  algorithmId: AlgorithmId
  palette: RGB[]
  params: Record<string, number | boolean>
}

// ---- Color utilities ----

function nearestColor(r: number, g: number, b: number, palette: RGB[]): RGB {
  let best = palette[0]
  let bestDist = Infinity
  for (const c of palette) {
    const dr = r - c[0], dg = g - c[1], db = b - c[2]
    const d = dr*dr + dg*dg + db*db
    if (d < bestDist) { bestDist = d; best = c }
  }
  return best
}

function getLuminance(r: number, g: number, b: number): number {
  return 0.299*r + 0.587*g + 0.114*b
}

// ---- Global pre-processing: brightness + saturation ----

function preprocess(imageData: ImageData, brightness: number, saturation: number): ImageData {
  if (brightness === 0 && saturation === 1) return imageData
  const { width, height, data } = imageData
  const out = new ImageData(width, height)
  for (let i = 0; i < width * height; i++) {
    const ri = i * 4
    let r = data[ri] / 255, g = data[ri+1] / 255, b = data[ri+2] / 255
    // Saturation: lerp toward luminance
    const lum = 0.299*r + 0.587*g + 0.114*b
    r = lum + (r - lum) * saturation
    g = lum + (g - lum) * saturation
    b = lum + (b - lum) * saturation
    // Brightness
    r += brightness; g += brightness; b += brightness
    out.data[ri]   = Math.max(0, Math.min(255, r * 255))
    out.data[ri+1] = Math.max(0, Math.min(255, g * 255))
    out.data[ri+2] = Math.max(0, Math.min(255, b * 255))
    out.data[ri+3] = data[ri+3]
  }
  return out
}

// ---- Error diffusion ----

type ErrorEntry = { dx: number; dy: number; weight: number }

const MATRICES: Record<string, ErrorEntry[]> = {
  'floyd-steinberg': [
    {dx:1,dy:0,weight:7/16},{dx:-1,dy:1,weight:3/16},
    {dx:0,dy:1,weight:5/16},{dx:1,dy:1,weight:1/16},
  ],
  atkinson: [
    {dx:1,dy:0,weight:1/8},{dx:2,dy:0,weight:1/8},
    {dx:-1,dy:1,weight:1/8},{dx:0,dy:1,weight:1/8},
    {dx:1,dy:1,weight:1/8},{dx:0,dy:2,weight:1/8},
  ],
  stucki: [
    {dx:1,dy:0,weight:8/42},{dx:2,dy:0,weight:4/42},
    {dx:-2,dy:1,weight:2/42},{dx:-1,dy:1,weight:4/42},
    {dx:0,dy:1,weight:8/42},{dx:1,dy:1,weight:4/42},
    {dx:2,dy:1,weight:2/42},{dx:-2,dy:2,weight:1/42},
    {dx:-1,dy:2,weight:2/42},{dx:0,dy:2,weight:4/42},
    {dx:1,dy:2,weight:2/42},{dx:2,dy:2,weight:1/42},
  ],
  burkes: [
    {dx:1,dy:0,weight:8/32},{dx:2,dy:0,weight:4/32},
    {dx:-2,dy:1,weight:2/32},{dx:-1,dy:1,weight:4/32},
    {dx:0,dy:1,weight:8/32},{dx:1,dy:1,weight:4/32},
    {dx:2,dy:1,weight:2/32},
  ],
  sierra: [
    {dx:1,dy:0,weight:5/32},{dx:2,dy:0,weight:3/32},
    {dx:-2,dy:1,weight:2/32},{dx:-1,dy:1,weight:4/32},
    {dx:0,dy:1,weight:5/32},{dx:1,dy:1,weight:4/32},
    {dx:2,dy:1,weight:2/32},{dx:-1,dy:2,weight:2/32},
    {dx:0,dy:2,weight:3/32},{dx:1,dy:2,weight:2/32},
  ],
}

function errorDiffuse(
  imageData: ImageData, algorithmId: string, palette: RGB[],
  serpentine: boolean, threshold: number, spread: number
): ImageData {
  const { width, height, data } = imageData
  const out = new ImageData(width, height)
  const buf = new Float32Array(width * height * 3)
  for (let i = 0; i < width * height; i++) {
    buf[i*3] = data[i*4]; buf[i*3+1] = data[i*4+1]; buf[i*3+2] = data[i*4+2]
  }
  const matrix = MATRICES[algorithmId]
  const tShift = (threshold - 0.5) * 255
  for (let y = 0; y < height; y++) {
    const ltr = !serpentine || (y % 2 === 0)
    const x0 = ltr ? 0 : width-1, x1 = ltr ? width : -1, xs = ltr ? 1 : -1
    for (let x = x0; x !== x1; x += xs) {
      const i = (y*width+x)*3
      const r = Math.max(0, Math.min(255, buf[i]   + tShift))
      const g = Math.max(0, Math.min(255, buf[i+1] + tShift))
      const b = Math.max(0, Math.min(255, buf[i+2] + tShift))
      const [nr, ng, nb] = nearestColor(r, g, b, palette)
      const pi = (y*width+x)*4
      out.data[pi]=nr; out.data[pi+1]=ng; out.data[pi+2]=nb; out.data[pi+3]=255
      const er = (r-nr)*spread, eg = (g-ng)*spread, eb = (b-nb)*spread
      for (const e of matrix) {
        const nx = x + (ltr ? e.dx : -e.dx), ny = y + e.dy
        if (nx<0||nx>=width||ny<0||ny>=height) continue
        const ni = (ny*width+nx)*3
        buf[ni]+=er*e.weight; buf[ni+1]+=eg*e.weight; buf[ni+2]+=eb*e.weight
      }
    }
  }
  return out
}

// ---- Ordered / Bayer ----

const BAYER_2 = [[0,2],[3,1]]
const BAYER_4 = [[0,8,2,10],[12,4,14,6],[3,11,1,9],[15,7,13,5]]
const BAYER_8 = [
  [0,32,8,40,2,34,10,42],[48,16,56,24,50,18,58,26],
  [12,44,4,36,14,46,6,38],[60,28,52,20,62,30,54,22],
  [3,35,11,43,1,33,9,41],[51,19,59,27,49,17,57,25],
  [15,47,7,39,13,45,5,37],[63,31,55,23,61,29,53,21],
]

function applyContrast(v: number, contrast: number): number {
  return Math.max(0, Math.min(255, (v - 128) * contrast + 128))
}

function bayerDither(
  imageData: ImageData, matrix: number[][], palette: RGB[],
  scale: number, threshold: number, contrast: number
): ImageData {
  const {width,height,data} = imageData
  const out = new ImageData(width,height)
  const n = matrix.length, maxVal = n*n
  const tOff = threshold - 0.5
  for (let y=0;y<height;y++) {
    for (let x=0;x<width;x++) {
      const idx=(y*width+x)*4
      const bv = matrix[Math.floor(y/scale)%n][Math.floor(x/scale)%n]/maxVal - 0.5 + tOff
      const [nr,ng,nb] = nearestColor(
        Math.max(0,Math.min(255, applyContrast(data[idx],   contrast) + bv*255)),
        Math.max(0,Math.min(255, applyContrast(data[idx+1], contrast) + bv*255)),
        Math.max(0,Math.min(255, applyContrast(data[idx+2], contrast) + bv*255)),
        palette
      )
      out.data[idx]=nr; out.data[idx+1]=ng; out.data[idx+2]=nb; out.data[idx+3]=255
    }
  }
  return out
}

function hatch(
  imageData: ImageData, palette: RGB[],
  scale: number, angle: number, lineWidth: number, threshold: number
): ImageData {
  const {width,height,data} = imageData
  const out = new ImageData(width,height)
  const tOff = threshold - 0.5
  const rad = angle * Math.PI / 180
  const cosA = Math.cos(rad), sinA = Math.sin(rad)
  const lw = lineWidth
  for (let y=0;y<height;y++) {
    for (let x=0;x<width;x++) {
      const idx=(y*width+x)*4
      const lum = getLuminance(data[idx],data[idx+1],data[idx+2])/255
      const adj = Math.max(0,Math.min(1,lum+tOff))
      // Rotate pixel coords by angle
      const d1 =  x*cosA + y*sinA   // primary direction
      const d2 = -x*sinA + y*cosA   // perpendicular
      const diagA = (((d1 % scale) + scale) % scale) < lw
      const diagB = (((d2 % scale) + scale) % scale) < lw
      let isBlack = false
      if (adj<0.25) isBlack = diagA||diagB
      else if (adj<0.5) isBlack = diagA
      else if (adj<0.75) isBlack = (((d1 % (scale*2)) + scale*2) % (scale*2)) < lw
      const c = isBlack ? palette[0] : palette[palette.length-1]
      out.data[idx]=c[0]; out.data[idx+1]=c[1]; out.data[idx+2]=c[2]; out.data[idx+3]=255
    }
  }
  return out
}

function halftone(
  imageData: ImageData, palette: RGB[],
  scale: number, angle: number, contrast: number
): ImageData {
  const {width,height,data} = imageData
  const out = new ImageData(width,height)
  const light = palette[palette.length-1]
  const dark = palette[0]
  for (let i=0;i<width*height;i++) {
    out.data[i*4]=light[0]; out.data[i*4+1]=light[1]; out.data[i*4+2]=light[2]; out.data[i*4+3]=255
  }
  const rad = angle*Math.PI/180
  const cos=Math.cos(rad), sin=Math.sin(rad)
  const gridW=Math.ceil(width/scale)+4, gridH=Math.ceil(height/scale)+4
  for (let gy=-2;gy<gridH;gy++) {
    for (let gx=-2;gx<gridW;gx++) {
      const cx0=(gx+0.5)*scale, cy0=(gy+0.5)*scale
      const cx=Math.round(cx0*cos-cy0*sin)
      const cy=Math.round(cx0*sin+cy0*cos)
      if (cx<0||cx>=width||cy<0||cy>=height) continue
      const si=(Math.max(0,Math.min(height-1,cy))*width+Math.max(0,Math.min(width-1,cx)))*4
      const rawLum = getLuminance(data[si],data[si+1],data[si+2])/255
      const contrastLum = Math.max(0, Math.min(1, (rawLum - 0.5) * contrast + 0.5))
      const lum = 1 - contrastLum
      const radius=Math.sqrt(lum)*scale*0.5
      const r2=Math.ceil(radius)
      for (let dy=-r2;dy<=r2;dy++) {
        for (let dx=-r2;dx<=r2;dx++) {
          if (dx*dx+dy*dy<=radius*radius) {
            const px=cx+dx,py=cy+dy
            if (px>=0&&px<width&&py>=0&&py<height) {
              const pi=(py*width+px)*4
              out.data[pi]=dark[0]; out.data[pi+1]=dark[1]; out.data[pi+2]=dark[2]
            }
          }
        }
      }
    }
  }
  return out
}

function riemersma(
  imageData: ImageData, palette: RGB[],
  histLen: number, threshold: number, decay: number
): ImageData {
  const {width,height,data} = imageData
  const out = new ImageData(width,height)
  const hl = Math.max(4,histLen)
  const weights: number[] = []
  for (let i=0;i<hl;i++) weights[i]=Math.exp(-decay*i)
  const wSum = weights.reduce((a,b)=>a+b,0)
  const errR=new Float32Array(hl), errG=new Float32Array(hl), errB=new Float32Array(hl)
  let head=0
  const tShift=(threshold-0.5)*255
  for (let y=0;y<height;y++) {
    for (let x=0;x<width;x++) {
      const idx=(y*width+x)*4
      const r=data[idx],g=data[idx+1],b=data[idx+2]
      let wr=0,wg=0,wb=0
      for (let i=0;i<hl;i++) {
        const hi=(head+i)%hl
        const w=weights[hl-1-i]/wSum
        wr+=errR[hi]*w; wg+=errG[hi]*w; wb+=errB[hi]*w
      }
      const [nr,ng,nb]=nearestColor(
        Math.max(0,Math.min(255,r+wr+tShift)),
        Math.max(0,Math.min(255,g+wg+tShift)),
        Math.max(0,Math.min(255,b+wb+tShift)),
        palette
      )
      out.data[idx]=nr; out.data[idx+1]=ng; out.data[idx+2]=nb; out.data[idx+3]=255
      errR[head]=r-nr; errG[head]=g-ng; errB[head]=b-nb
      head=(head+1)%hl
    }
  }
  return out
}

// ---- Message handler ----

self.onmessage = (e: MessageEvent<DitherRequest>) => {
  const {id, imageData, algorithmId, palette, params} = e.data
  const brightness = (params.brightness as number) ?? 0
  const saturation = (params.saturation as number) ?? 1
  const src = preprocess(imageData, brightness, saturation)
  let result: ImageData
  try {
    switch(algorithmId) {
      case 'floyd-steinberg': case 'atkinson': case 'stucki': case 'burkes': case 'sierra':
        result = errorDiffuse(src, algorithmId, palette,
          params.serpentine as boolean,
          params.threshold as number,
          (params.spread as number) ?? 1)
        break
      case 'bayer2': result = bayerDither(src, BAYER_2, palette, params.scale as number, params.threshold as number, (params.contrast as number) ?? 1); break
      case 'bayer4': result = bayerDither(src, BAYER_4, palette, params.scale as number, params.threshold as number, (params.contrast as number) ?? 1); break
      case 'bayer8': result = bayerDither(src, BAYER_8, palette, params.scale as number, params.threshold as number, (params.contrast as number) ?? 1); break
      case 'hatch':  result = hatch(src, palette, params.scale as number, (params.angle as number) ?? 45, (params.lineWidth as number) ?? 1, params.threshold as number); break
      case 'halftone': result = halftone(src, palette, params.scale as number, params.angle as number, (params.contrast as number) ?? 1); break
      case 'riemersma': result = riemersma(src, palette, params.mapSize as number, params.threshold as number, (params.decay as number) ?? 0.5); break
      default: result = src
    }
    ;(self as unknown as Worker).postMessage({id, imageData: result}, [result.data.buffer])
  } catch(err) {
    console.error('Worker error:', err)
  }
}
