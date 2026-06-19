'use client'
import { useRef, useEffect, useState, useCallback } from 'react'
import { RotateCcw, X, Download } from 'lucide-react'
import { ALGORITHMS, type AlgorithmId, getDefaultParams } from '@/lib/algorithms/index'
import { PALETTES, type PaletteId } from '@/lib/palettes'
import InputZone from './InputZone'

interface Props {
  algorithmId: AlgorithmId
  onAlgorithmChange: (id: AlgorithmId) => void
  params: Record<string, number | boolean>
  onParamChange: (key: string, value: number | boolean) => void
  onResetParams: () => void
  paletteId: PaletteId
  onPaletteChange: (id: PaletteId) => void
  colorA: string
  colorB: string
  onColorAChange: (c: string) => void
  onColorBChange: (c: string) => void
  onImage: (bitmap: ImageBitmap, name: string) => void
  onVideo: (videoEl: HTMLVideoElement, name: string) => void
  sourceName: string | null
  onClearSource: () => void
  onDownload: () => void
  onClose?: () => void
  showClose?: boolean
}

function Section({ title, children, extra }: { title: string; children: React.ReactNode; extra?: React.ReactNode }) {
  const [open, setOpen] = useState(true)
  return (
    <div className="border-b border-[var(--border)]">
      <div className="flex items-center justify-between hover:bg-[var(--accent)]/20 transition-colors">
        <button
          onClick={() => setOpen(o => !o)}
          className="flex-1 flex items-center justify-between px-3 lg:px-4 py-2 lg:py-2.5 text-left"
        >
          <span className="font-mono text-[9px] lg:text-[10px] tracking-widest uppercase text-[var(--muted-foreground)]">{title}</span>
          <span className="font-mono text-[10px] text-[var(--muted-foreground)]/40 ml-2">{open ? '−' : '+'}</span>
        </button>
        {extra && <div className="pr-3 lg:pr-4">{extra}</div>}
      </div>
      <div
        style={{ gridTemplateRows: open ? '1fr' : '0fr' }}
        className="grid transition-[grid-template-rows] duration-[220ms] ease-[cubic-bezier(0.4,0,0.2,1)]"
      >
        <div className="overflow-hidden">
          <div className="px-3 lg:px-4 pb-3 lg:pb-4 pt-1">
            {children}
          </div>
        </div>
      </div>
    </div>
  )
}

const CATEGORIES = [
  { id: 'error-diffusion' as const, label: 'Error Diffusion' },
  { id: 'ordered' as const, label: 'Ordered' },
  { id: 'stylize' as const, label: 'Stylize' },
]

export default function ControlPanel({
  algorithmId, onAlgorithmChange, params, onParamChange, onResetParams,
  paletteId, onPaletteChange, colorA, colorB, onColorAChange, onColorBChange,
  onImage, onVideo, sourceName, onClearSource, onDownload, onClose, showClose
}: Props) {
  const listRef = useRef<HTMLDivElement>(null)
  const buttonRefs = useRef<Map<AlgorithmId, HTMLButtonElement>>(new Map())
  const [indicatorStyle, setIndicatorStyle] = useState({ top: 0, height: 0 })
  const [fading, setFading] = useState(false)

  const algo = ALGORITHMS.find(a => a.id === algorithmId)!

  useEffect(() => {
    const btn = buttonRefs.current.get(algorithmId)
    const list = listRef.current
    if (!btn || !list) return
    setIndicatorStyle({ top: btn.offsetTop, height: btn.offsetHeight })
  }, [algorithmId])

  const handleAlgorithmChange = useCallback((id: AlgorithmId) => {
    setFading(true)
    setTimeout(() => setFading(false), 180)
    onAlgorithmChange(id)
  }, [onAlgorithmChange])

  return (
    <div className="flex flex-col h-full w-[280px] lg:w-[312px] bg-[var(--card)] border-l border-[var(--border)] overflow-y-auto">
      {/* Header */}
      <div className="flex items-center justify-between px-3 lg:px-4 py-3 lg:py-4 border-b border-[var(--border)] shrink-0">
        <div className="hidden lg:block">
          <div className="text-xl leading-none" style={{ fontFamily: 'var(--font-unifraktur)' }}>Noise</div>
          <div className="font-mono text-[10px] text-[var(--muted-foreground)]/60 mt-0.5">dither studio</div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={onDownload}
            title="Download PNG"
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded font-mono text-[11px] border border-[var(--border)] hover:border-[var(--primary)]/50 hover:text-[var(--primary)] transition-all"
          >
            <Download size={11} />
            <span className="hidden lg:inline">Export</span>
          </button>
          {showClose && (
            <button onClick={onClose} className="lg:hidden opacity-50 hover:opacity-100 transition-opacity p-1">
              <X size={15} />
            </button>
          )}
        </div>
      </div>

      {/* Algorithm selector */}
      <div className="px-3 lg:px-4 py-3 border-b border-[var(--border)] shrink-0">
        <div ref={listRef} className="relative">
          {indicatorStyle.height > 0 && (
            <div
              style={{
                position: 'absolute',
                left: 0, right: 0,
                top: indicatorStyle.top,
                height: indicatorStyle.height,
                background: 'var(--mint-dim)',
                border: '1px solid var(--border)',
                borderRadius: 4,
                transition: 'top 200ms cubic-bezier(0.4, 0, 0.2, 1)',
                pointerEvents: 'none',
              }}
            />
          )}
          {CATEGORIES.map(cat => (
            <div key={cat.id} className="mb-1 last:mb-0">
              <div className="font-mono text-[8px] lg:text-[9px] tracking-widest uppercase text-[var(--muted-foreground)]/30 px-2 pt-2 pb-1">{cat.label}</div>
              {ALGORITHMS.filter(a => a.category === cat.id).map(a => (
                <button
                  key={a.id}
                  ref={el => { if (el) buttonRefs.current.set(a.id, el) }}
                  onClick={() => handleAlgorithmChange(a.id)}
                  className={[
                    'relative w-full text-left flex items-center justify-between px-2 py-1.5 rounded-sm transition-colors font-mono text-[11px] lg:text-xs',
                    algorithmId === a.id
                      ? 'text-[var(--primary)]'
                      : 'text-[var(--foreground)]/50 hover:text-[var(--foreground)]/80'
                  ].join(' ')}
                >
                  <span>{a.name}</span>
                  {algorithmId === a.id && <span className="w-1 h-1 rounded-full bg-[var(--primary)] shrink-0" />}
                </button>
              ))}
            </div>
          ))}
        </div>
      </div>

      {/* Input */}
      <Section title="Input">
        <InputZone onImage={onImage} onVideo={onVideo} sourceName={sourceName} onClear={onClearSource} />
      </Section>

      {/* Palette */}
      <Section title="Palette">
        <div className="grid grid-cols-4 gap-1.5 mb-3">
          {PALETTES.map(p => (
            <button
              key={p.id}
              onClick={() => onPaletteChange(p.id)}
              title={p.name}
              className={[
                'flex flex-col items-center gap-1 p-1.5 rounded transition-all',
                paletteId === p.id
                  ? 'ring-1 ring-[var(--primary)] ring-offset-1 ring-offset-[var(--card)]'
                  : 'opacity-50 hover:opacity-80'
              ].join(' ')}
            >
              <div className="flex h-3 w-full rounded-sm overflow-hidden">
                {p.colors.slice(0, 8).map((c, i) => (
                  <div key={i} className="flex-1" style={{ background: `rgb(${c[0]},${c[1]},${c[2]})` }} />
                ))}
              </div>
              <span className="font-mono text-[8px] text-[var(--muted-foreground)] truncate w-full text-center">{p.name}</span>
            </button>
          ))}
        </div>
        {paletteId === 'custom' && (
          <div className="space-y-2 mt-1">
            {[['A', colorA, onColorAChange], ['B', colorB, onColorBChange]].map(([label, val, handler]) => (
              <div key={label as string} className="flex items-center gap-2.5">
                <span className="font-mono text-xs text-[var(--muted-foreground)] w-5">{label as string}</span>
                <input
                  type="color"
                  value={val as string}
                  onChange={e => (handler as (v: string) => void)(e.target.value)}
                  className="h-7 flex-1 rounded border border-[var(--border)] bg-transparent cursor-pointer"
                />
              </div>
            ))}
          </div>
        )}
      </Section>

      {/* Parameters */}
      <Section
        title="Parameters"
        extra={
          <button onClick={onResetParams} title="Reset" className="opacity-30 hover:opacity-80 transition-opacity">
            <RotateCcw size={10} />
          </button>
        }
      >
        <div className="space-y-4" style={{ opacity: fading ? 0 : 1, transition: 'opacity 180ms' }}>
          {algo.params.map(param => (
            <div key={param.key}>
              {param.type === 'range' && (
                <>
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="font-mono text-[10px] lg:text-xs uppercase tracking-wide text-[var(--muted-foreground)]">{param.label}</label>
                    <span className="font-mono text-[10px] lg:text-xs tabular-nums text-[var(--foreground)]/60">
                      {param.step && param.step < 0.1
                        ? (params[param.key] as number).toFixed(2)
                        : params[param.key]}{param.unit ?? ''}
                    </span>
                  </div>
                  <input
                    type="range"
                    min={param.min} max={param.max} step={param.step}
                    value={params[param.key] as number}
                    onChange={e => onParamChange(param.key, parseFloat(e.target.value))}
                    className="w-full"
                  />
                  <div className="flex justify-between mt-1">
                    <span className="font-mono text-[9px] text-[var(--muted-foreground)]/30">{param.min}</span>
                    <span className="font-mono text-[9px] text-[var(--muted-foreground)]/30">{param.max}{param.unit ?? ''}</span>
                  </div>
                </>
              )}
              {param.type === 'boolean' && (
                <div className="flex items-center justify-between">
                  <label className="font-mono text-[10px] lg:text-xs uppercase tracking-wide text-[var(--muted-foreground)]">{param.label}</label>
                  <button
                    onClick={() => onParamChange(param.key, !(params[param.key] as boolean))}
                    className={[
                      'relative w-8 h-4 rounded-full overflow-hidden transition-colors duration-200',
                      params[param.key] ? 'bg-[var(--primary)]' : 'bg-[var(--muted-foreground)]/20'
                    ].join(' ')}
                  >
                    <span className={[
                      'absolute top-0.5 w-3 h-3 rounded-full bg-white shadow-sm transition-transform duration-200',
                      params[param.key] ? 'translate-x-[18px]' : 'translate-x-0.5'
                    ].join(' ')} />
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
        <p className="mt-4 font-mono text-[9px] lg:text-[10px] leading-relaxed text-[var(--muted-foreground)]/40">
          {algo.description}
        </p>
      </Section>
    </div>
  )
}
