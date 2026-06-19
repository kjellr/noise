'use client'
import { useRef, useEffect, useCallback } from 'react'
import { ImageIcon } from 'lucide-react'
import { WebGLRenderer, WEBGL_ALGORITHMS } from '@/lib/webglRenderer'
import type { AlgorithmId } from '@/lib/algorithms/index'

type RGB = [number, number, number]

interface Props {
  imageData: ImageData | null
  isProcessing: boolean
  // WebGL live-render props (video mode with ordered algorithms)
  liveSource?: HTMLVideoElement | null
  algorithmId?: AlgorithmId
  palette?: RGB[]
  params?: Record<string, number | boolean>
}

export default function DitherCanvas({
  imageData, isProcessing,
  liveSource, algorithmId, palette, params,
}: Props) {
  const containerRef  = useRef<HTMLDivElement>(null)
  const canvas2dRef   = useRef<HTMLCanvasElement>(null)
  const canvasGLRef   = useRef<HTMLCanvasElement>(null)
  const rendererRef   = useRef<WebGLRenderer | null>(null)
  const rafRef        = useRef<number | null>(null)

  const isWebGL = !!(liveSource && algorithmId && WEBGL_ALGORITHMS.has(algorithmId))

  // ---- 2D canvas: draw imageData ----
  const draw2d = useCallback(() => {
    const canvas = canvas2dRef.current
    const container = containerRef.current
    if (!canvas || !container) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    const w = container.clientWidth
    const h = container.clientHeight
    canvas.width = w
    canvas.height = h
    ctx.fillStyle = 'oklch(0.05 0.006 240)'
    ctx.fillRect(0, 0, w, h)
    if (!imageData) return
    const scale = Math.min(w / imageData.width, h / imageData.height)
    const dw = imageData.width * scale
    const dh = imageData.height * scale
    const dx = (w - dw) / 2
    const dy = (h - dh) / 2
    const offscreen = document.createElement('canvas')
    offscreen.width = imageData.width
    offscreen.height = imageData.height
    offscreen.getContext('2d')!.putImageData(imageData, 0, 0)
    ctx.imageSmoothingEnabled = false
    ctx.drawImage(offscreen, dx, dy, dw, dh)
  }, [imageData])

  useEffect(() => { draw2d() }, [draw2d])

  useEffect(() => {
    const container = containerRef.current
    if (!container) return
    const observer = new ResizeObserver(draw2d)
    observer.observe(container)
    return () => observer.disconnect()
  }, [draw2d])

  // ---- WebGL canvas: live video rendering ----
  useEffect(() => {
    const glCanvas = canvasGLRef.current
    if (!glCanvas) return

    if (!isWebGL) {
      // Stop any running loop
      if (rafRef.current) { cancelAnimationFrame(rafRef.current); rafRef.current = null }
      return
    }

    // Create renderer if needed
    if (!rendererRef.current) {
      try { rendererRef.current = new WebGLRenderer(glCanvas) }
      catch (e) { console.error('WebGL init failed:', e); return }
    }

    const renderer = rendererRef.current
    const source = liveSource!
    const algoId = algorithmId!
    const pal = palette!
    const p = params!

    if (rafRef.current) cancelAnimationFrame(rafRef.current)

    const loop = () => {
      if (source.readyState >= 2) {
        renderer.render(source, algoId as Parameters<typeof renderer.render>[1], pal, p)
      }
      rafRef.current = requestAnimationFrame(loop)
    }
    rafRef.current = requestAnimationFrame(loop)

    return () => {
      if (rafRef.current) { cancelAnimationFrame(rafRef.current); rafRef.current = null }
    }
  }, [isWebGL, liveSource, algorithmId, palette, params])

  // Dispose renderer on unmount
  useEffect(() => {
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current)
      rendererRef.current?.dispose()
    }
  }, [])

  const hasContent = imageData || isWebGL

  return (
    <div ref={containerRef} className="relative w-full h-full">
      {/* 2D canvas — imageData from worker */}
      <canvas
        ref={canvas2dRef}
        className="absolute inset-0 w-full h-full"
        style={{ display: isWebGL ? 'none' : 'block' }}
      />
      {/* WebGL canvas — live ordered dithering */}
      <canvas
        ref={canvasGLRef}
        className="absolute inset-0 w-full h-full"
        style={{ display: isWebGL ? 'block' : 'none' }}
      />

      {!hasContent && !isProcessing && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <div className="flex flex-col items-center gap-3 opacity-[0.15]">
            <ImageIcon size={36} strokeWidth={1} />
            <p className="font-mono text-xs tracking-widest uppercase">Drop an image to get started</p>
          </div>
        </div>
      )}
      {isProcessing && !isWebGL && (
        <div className="absolute top-4 right-4 pointer-events-none">
          <div className="w-1.5 h-1.5 rounded-full bg-[var(--primary)] animate-pulse" />
        </div>
      )}
    </div>
  )
}
