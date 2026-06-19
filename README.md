# Noise ✦

A browser-based dithering studio. Upload an image or video and shape the result with real-time controls — from classic error diffusion to GPU-accelerated ordered patterns.

**[Try it →](https://kjellr.github.io/noise/)**

---

## Algorithms ✦

**Error diffusion** — Floyd-Steinberg, Atkinson, Stucki, Burkes, Sierra. Each pixel's quantization error bleeds into its neighbors, producing organic, low-noise results. Processed in a Web Worker to keep the UI responsive.

**Ordered / Bayer** — 2×2, 4×4, and 8×8 Bayer matrices. Deterministic threshold patterns with a classic screentone look. Runs as a WebGL fragment shader for 60fps live video.

**Hatch** — Diagonal line hatching as seen in engraving and pen-and-ink illustration. Angle and line width are adjustable. GPU-accelerated.

**Halftone** — Circular dots as seen in offset printing and comic books. Cell size and angle are adjustable. GPU-accelerated.

**Riemersma** — Space-filling curve dithering with exponential error history. Organic, low-noise results with less directional banding than standard error diffusion.

## Controls 🎛️

Each algorithm exposes relevant parameters via sliders — threshold, scale, spread, contrast, angle, line width, decay, and more. A palette section lets you pick from presets (Mono, 2-bit Gray, 4-bit Gray, CGA, Game Boy, PICO-8) or set two custom colors. Global brightness and saturation controls apply to all algorithms.

## Built with 🛠️

- [Next.js](https://nextjs.org/) — framework
- [Web Workers](https://developer.mozilla.org/en-US/docs/Web/API/Web_Workers_API) — off-thread CPU dithering for error diffusion algorithms
- [WebGL2](https://www.khronos.org/webgl/) — GPU-accelerated fragment shaders for ordered algorithms
- [Tailwind CSS](https://tailwindcss.com/) — styling

## Running locally

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

---

Built by [Kjell Reigstad](https://kjellr.com)
