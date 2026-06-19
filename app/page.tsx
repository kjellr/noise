'use client'
import { useState, useEffect, useRef, useCallback } from 'react'
import { ExternalLink, Settings } from 'lucide-react'
import DitherCanvas from '@/components/DitherCanvas'
import ControlPanel from '@/components/ControlPanel'
import { type AlgorithmId, getDefaultParams } from '@/lib/algorithms/index'
import { type PaletteId, getPalette } from '@/lib/palettes'
import { WEBGL_ALGORITHMS } from '@/lib/webglRenderer'

export default function Page() {
  const [algorithmId, setAlgorithmId] = useState<AlgorithmId>('riemersma')
  const [params, setParams] = useState<Record<string, number | boolean>>(
    () => getDefaultParams('riemersma')
  )
  const [paletteId, setPaletteId] = useState<PaletteId>('mono')
  const [colorA, setColorA] = useState('#ffffff')
  const [colorB, setColorB] = useState('#000000')
  const [sourceName, setSourceName] = useState<string | null>(null)
  const [liveVideo, setLiveVideo] = useState<HTMLVideoElement | null>(null)
  const [outputImageData, setOutputImageData] = useState<ImageData | null>(null)
  const [isProcessing, setIsProcessing] = useState(false)
  const [sidebarOpen, setSidebarOpen] = useState(false)

  const workerRef = useRef<Worker | null>(null)
  const requestIdRef = useRef(0)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const rafRef = useRef<number | null>(null)
  const workerBusyRef = useRef(false)
  const captureCanvasRef = useRef<HTMLCanvasElement | null>(null)

  // Source refs — avoid stale closures in RAF loop
  const sourceBitmapRef = useRef<ImageBitmap | null>(null)
  const sourceVideoRef = useRef<HTMLVideoElement | null>(null)
  const algorithmIdRef = useRef<AlgorithmId>('riemersma')
  const paramsRef = useRef<Record<string, number | boolean>>(getDefaultParams('riemersma'))
  const paletteIdRef = useRef<PaletteId>('mono')
  const colorARef = useRef('#ffffff')
  const colorBRef = useRef('#000000')

  useEffect(() => { algorithmIdRef.current = algorithmId }, [algorithmId])
  useEffect(() => { paramsRef.current = params }, [params])
  useEffect(() => { paletteIdRef.current = paletteId }, [paletteId])
  useEffect(() => { colorARef.current = colorA }, [colorA])
  useEffect(() => { colorBRef.current = colorB }, [colorB])

  // Init worker
  useEffect(() => {
    const worker = new Worker(new URL('../lib/ditherWorker.ts', import.meta.url))
    worker.onmessage = (e: MessageEvent<{ id: number; imageData: ImageData }>) => {
      if (e.data.id === requestIdRef.current) {
        setOutputImageData(e.data.imageData)
        setIsProcessing(false)
        workerBusyRef.current = false
      }
    }
    workerRef.current = worker
    return () => worker.terminate()
  }, [])

  // Send a single frame (image bitmap or video element) to the worker
  const sendFrame = useCallback((source: ImageBitmap | HTMLVideoElement) => {
    const worker = workerRef.current
    if (!worker) return
    if (!captureCanvasRef.current) captureCanvasRef.current = document.createElement('canvas')
    const cap = captureCanvasRef.current

    // Error diffusion is sequential — cap video frames aggressively
    const MAX_VIDEO_DIM = 240
    const isVideo = source instanceof HTMLVideoElement
    const srcW = isVideo ? (source.videoWidth || 640) : source.width
    const srcH = isVideo ? (source.videoHeight || 480) : source.height
    const scale = isVideo ? Math.min(1, MAX_VIDEO_DIM / Math.max(srcW, srcH)) : 1
    cap.width = Math.round(srcW * scale)
    cap.height = Math.round(srcH * scale)

    const ctx = cap.getContext('2d')!
    ctx.drawImage(source, 0, 0, cap.width, cap.height)
    const imageData = ctx.getImageData(0, 0, cap.width, cap.height)
    const palette = getPalette(paletteIdRef.current, colorARef.current, colorBRef.current)
    const id = ++requestIdRef.current
    workerBusyRef.current = true
    setIsProcessing(true)
    worker.postMessage(
      { id, imageData, algorithmId: algorithmIdRef.current, palette, params: paramsRef.current },
      [imageData.data.buffer]
    )
  }, [])

  // RAF loop for live video processing
  const startVideoLoop = useCallback(() => {
    const loop = () => {
      const video = sourceVideoRef.current
      if (video && !video.paused && !workerBusyRef.current && video.readyState >= 2) {
        sendFrame(video)
      }
      rafRef.current = requestAnimationFrame(loop)
    }
    rafRef.current = requestAnimationFrame(loop)
  }, [sendFrame])

  const stopVideoLoop = useCallback(() => {
    if (rafRef.current) {
      cancelAnimationFrame(rafRef.current)
      rafRef.current = null
    }
  }, [])

  // Process static image (debounced)
  const processImage = useCallback((immediate = false) => {
    const bitmap = sourceBitmapRef.current
    if (!bitmap) return
    if (debounceRef.current) clearTimeout(debounceRef.current)
    const run = () => sendFrame(bitmap)
    if (immediate) run()
    else debounceRef.current = setTimeout(run, 200)
  }, [sendFrame])

  // Trigger reprocess when params/palette change
  useEffect(() => {
    if (sourceBitmapRef.current && !sourceVideoRef.current) {
      processImage(false)
    }
    // Video loop picks up new params automatically via refs — no action needed
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params, paletteId, colorA, colorB])

  // Reprocess image immediately on algorithm change
  useEffect(() => {
    if (sourceBitmapRef.current && !sourceVideoRef.current) {
      processImage(true)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [algorithmId])

  const handleImage = useCallback((bitmap: ImageBitmap, name: string) => {
    stopVideoLoop()
    sourceVideoRef.current = null
    setLiveVideo(null)
    sourceBitmapRef.current = bitmap
    setSourceName(name)
    sendFrame(bitmap)
  }, [stopVideoLoop, sendFrame])

  const handleVideo = useCallback((videoEl: HTMLVideoElement, name: string) => {
    stopVideoLoop()
    sourceBitmapRef.current = null
    sourceVideoRef.current = videoEl
    setLiveVideo(videoEl)
    setSourceName(name)
    // Only start the worker loop for non-WebGL algorithms; WebGL handles its own RAF
    if (!WEBGL_ALGORITHMS.has(algorithmIdRef.current)) {
      startVideoLoop()
    }
  }, [stopVideoLoop, startVideoLoop])

  const handleClear = useCallback(() => {
    stopVideoLoop()
    sourceBitmapRef.current = null
    sourceVideoRef.current = null
    setLiveVideo(null)
    setSourceName(null)
    setOutputImageData(null)
  }, [stopVideoLoop])

  const handleAlgorithmChange = (id: AlgorithmId) => {
    setAlgorithmId(id)
    setParams(getDefaultParams(id))
    // Switch video processing mode when changing algorithm category
    if (sourceVideoRef.current) {
      if (WEBGL_ALGORITHMS.has(id)) {
        stopVideoLoop() // WebGL canvas handles its own RAF
      } else {
        startVideoLoop() // Use worker loop for error diffusion
      }
    }
  }

  const handleDownload = () => {
    if (!outputImageData) return
    const c = document.createElement('canvas')
    c.width = outputImageData.width
    c.height = outputImageData.height
    c.getContext('2d')!.putImageData(outputImageData, 0, 0)
    const a = document.createElement('a')
    a.href = c.toDataURL('image/png')
    a.download = `noise-${algorithmId}.png`
    a.click()
  }

  const sharedProps = {
    algorithmId, onAlgorithmChange: handleAlgorithmChange,
    params, onParamChange: (k: string, v: number | boolean) => setParams(p => ({ ...p, [k]: v })),
    onResetParams: () => setParams(getDefaultParams(algorithmId)),
    paletteId, onPaletteChange: setPaletteId,
    colorA, colorB, onColorAChange: setColorA, onColorBChange: setColorB,
    onImage: handleImage,
    onVideo: handleVideo,
    sourceName,
    onClearSource: handleClear,
    onDownload: handleDownload,
  }

  return (
    <div className="flex h-screen w-screen overflow-hidden" style={{ background: 'oklch(0.05 0.006 240)' }}>
      <div className="flex-1 relative overflow-hidden min-w-0">
        {/* Branding — mobile only */}
        <div className="lg:hidden absolute top-4 left-4 z-10 flex items-baseline gap-2" style={{ padding: 6 }}>
          <span style={{ fontFamily: 'var(--font-unifraktur)', fontSize: 24, color: 'var(--foreground)', lineHeight: 1 }}>Noise</span>
          <span className="text-xs" style={{ color: 'var(--muted-foreground)' }}>dither studio</span>
        </div>

        {/* Settings toggle — mobile only */}
        <button
          onClick={() => setSidebarOpen(true)}
          className="lg:hidden absolute top-4 right-4 z-10 flex items-center justify-center rounded-lg"
          style={{
            width: 36, height: 36,
            background: 'var(--panel)',
            border: '1px solid var(--border)',
            color: 'var(--muted-foreground)',
          }}
        >
          <Settings size={15} />
        </button>
        <a
          href="https://kjellr.com"
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-1.5 absolute bottom-6 left-6 text-xs font-mono px-2.5 py-1.5 rounded transition-all"
          style={{
            color: 'var(--muted-foreground)',
            background: 'var(--panel)',
            border: '1px solid var(--border)',
            zIndex: 10,
          }}
          onMouseEnter={e => {
            const el = e.currentTarget
            el.style.color = '#ffffff'
            el.style.borderColor = 'oklch(0.74 0.11 163 / 40%)'
          }}
          onMouseLeave={e => {
            const el = e.currentTarget
            el.style.color = 'var(--muted-foreground)'
            el.style.borderColor = 'var(--border)'
          }}
        >
          Built by Kjell Reigstad
          <ExternalLink size={11} />
        </a>
        <DitherCanvas
          imageData={outputImageData}
          isProcessing={isProcessing}
          liveSource={liveVideo}
          algorithmId={algorithmId}
          palette={getPalette(paletteId, colorA, colorB)}
          params={params}
        />
      </div>

      {/* Mobile backdrop */}
      {sidebarOpen && (
        <div
          className="lg:hidden fixed inset-0 z-20 bg-black/50"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <div className={[
        'fixed lg:relative right-0 top-0 h-full z-30',
        'transition-transform duration-300 ease-in-out',
        'lg:translate-x-0',
        sidebarOpen ? 'translate-x-0' : 'translate-x-full lg:translate-x-0',
      ].join(' ')}>
        <ControlPanel
          {...sharedProps}
          showClose
          onClose={() => setSidebarOpen(false)}
        />
      </div>
    </div>
  )
}
