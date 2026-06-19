'use client'
import { useRef, useState, useCallback, useEffect } from 'react'
import { X, Upload, Play, Pause } from 'lucide-react'

interface Props {
  onImage: (bitmap: ImageBitmap, name: string) => void
  onVideo: (videoEl: HTMLVideoElement, name: string) => void
  sourceName: string | null
  onClear: () => void
}

export default function InputZone({ onImage, onVideo, sourceName, onClear }: Props) {
  const [isDragging, setIsDragging] = useState(false)
  const [isPlaying, setIsPlaying] = useState(true)
  const [sourceType, setSourceType] = useState<'image' | 'video' | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const videoRef = useRef<HTMLVideoElement>(null)

  const commitVideo = useCallback((src: string, name: string) => {
    const vid = videoRef.current!
    vid.src = src
    vid.loop = true
    vid.muted = true
    vid.play().catch(() => {})
    setIsPlaying(true)
    setSourceType('video')
    onVideo(vid, name)
  }, [onVideo])

  // Load default video on mount
  useEffect(() => {
    const base = process.env.NEXT_PUBLIC_BASE_PATH ?? ''
    commitVideo(`${base}/logo-animation.mp4`, 'logo-animation.mp4')
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const handleFile = useCallback(async (file: File) => {
    if (file.type.startsWith('image/')) {
      const bitmap = await createImageBitmap(file)
      setSourceType('image')
      onImage(bitmap, file.name)
    } else if (file.type.startsWith('video/')) {
      const url = URL.createObjectURL(file)
      commitVideo(url, file.name)
    }
  }, [onImage, commitVideo])

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(false)
    const file = e.dataTransfer.files[0]
    if (file) handleFile(file)
  }, [handleFile])

  const togglePlay = () => {
    const vid = videoRef.current
    if (!vid) return
    if (vid.paused) { vid.play(); setIsPlaying(true) }
    else { vid.pause(); setIsPlaying(false) }
  }

  const handleClear = () => {
    const vid = videoRef.current
    if (vid) { vid.pause(); vid.src = '' }
    setSourceType(null)
    setIsPlaying(false)
    onClear()
  }

  return (
    <div className="flex flex-col gap-2">
      {/* Video element — always mounted so src/playback survive re-renders */}
      <video
        ref={videoRef}
        className={sourceType === 'video' ? 'w-full h-20 object-cover rounded' : 'hidden'}
        style={sourceType === 'video' ? { border: '1px solid var(--border)' } : undefined}
        muted loop playsInline
      />

      {/* Video controls */}
      {sourceType === 'video' && sourceName && (
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-1.5 min-w-0">
            <button onClick={togglePlay} className="opacity-50 hover:opacity-100 transition-opacity shrink-0">
              {isPlaying ? <Pause size={12} /> : <Play size={12} />}
            </button>
            <span className="font-mono text-[10px] text-[var(--muted-foreground)] truncate">
              {sourceName}
            </span>
          </div>
          <button onClick={handleClear} className="opacity-40 hover:opacity-100 transition-opacity shrink-0">
            <X size={12} />
          </button>
        </div>
      )}

      {/* Image name row */}
      {sourceType === 'image' && sourceName && (
        <div className="flex items-center justify-between gap-2 px-2.5 py-2 rounded border border-[var(--border)] bg-[var(--card)]">
          <span className="font-mono text-xs text-[var(--muted-foreground)] truncate">{sourceName}</span>
          <button onClick={handleClear} className="shrink-0 opacity-40 hover:opacity-100 transition-opacity">
            <X size={12} />
          </button>
        </div>
      )}

      {/* Drop zone — shown when no source */}
      {!sourceName && (
        <div
          onDrop={handleDrop}
          onDragOver={(e) => { e.preventDefault(); setIsDragging(true) }}
          onDragLeave={() => setIsDragging(false)}
          onClick={() => inputRef.current?.click()}
          className={[
            'flex flex-col items-center justify-center gap-2.5 rounded cursor-pointer py-8 transition-all duration-150',
            'border border-dashed',
            isDragging
              ? 'border-[var(--primary)] bg-[var(--primary)]/5'
              : 'border-[var(--border)] hover:border-[var(--primary)]/40'
          ].join(' ')}
        >
          <Upload size={16} strokeWidth={1.5} className="opacity-30" />
          <span className="font-mono text-[11px] text-[var(--muted-foreground)]/60">Drop image or video</span>
        </div>
      )}

      {/* Replace button */}
      {sourceName && (
        <button
          onClick={() => inputRef.current?.click()}
          onDrop={handleDrop}
          onDragOver={(e) => { e.preventDefault(); setIsDragging(true) }}
          onDragLeave={() => setIsDragging(false)}
          className={[
            'w-full flex items-center justify-center gap-1.5 py-1.5 rounded font-mono text-[10px]',
            'border border-dashed transition-all duration-150',
            isDragging
              ? 'border-[var(--primary)] text-[var(--primary)]'
              : 'border-[var(--border)] text-[var(--muted-foreground)]/40 hover:border-[var(--primary)]/40 hover:text-[var(--muted-foreground)]'
          ].join(' ')}
        >
          <Upload size={10} />
          Replace
        </button>
      )}

      <input
        ref={inputRef}
        type="file"
        accept="image/*,video/*"
        className="hidden"
        onChange={e => { const f = e.target.files?.[0]; if (f) handleFile(f) }}
      />
    </div>
  )
}
