export type AlgorithmId =
  | 'floyd-steinberg' | 'atkinson' | 'stucki' | 'burkes' | 'sierra'
  | 'bayer2' | 'bayer4' | 'bayer8' | 'hatch'
  | 'halftone' | 'riemersma'

export type ParamType = 'range' | 'boolean'

export interface ParamDef {
  key: string
  label: string
  type: ParamType
  min?: number
  max?: number
  step?: number
  default: number | boolean
  unit?: string
}

export interface AlgorithmDef {
  id: AlgorithmId
  name: string
  category: 'error-diffusion' | 'ordered' | 'stylize'
  description: string
  params: ParamDef[]
}

export const ALGORITHMS: AlgorithmDef[] = [
  {
    id: 'floyd-steinberg', name: 'Floyd-Steinberg', category: 'error-diffusion',
    description: 'Classic error-diffusion from 1976. Distributes quantization error to four neighboring pixels.',
    params: [
      { key: 'threshold', label: 'Threshold', type: 'range', min: 0, max: 1, step: 0.01, default: 0.5 },
      { key: 'serpentine', label: 'Serpentine', type: 'boolean', default: true },
    ]
  },
  {
    id: 'atkinson', name: 'Atkinson', category: 'error-diffusion',
    description: 'Developed at Apple for the Mac. Only distributes 6/8 of the error, preserving highlights and shadows.',
    params: [
      { key: 'threshold', label: 'Threshold', type: 'range', min: 0, max: 1, step: 0.01, default: 0.5 },
      { key: 'serpentine', label: 'Serpentine', type: 'boolean', default: true },
    ]
  },
  {
    id: 'stucki', name: 'Stucki', category: 'error-diffusion',
    description: 'High-quality variant with a wider 5×3 kernel. Sharp edges with minimal noise.',
    params: [
      { key: 'threshold', label: 'Threshold', type: 'range', min: 0, max: 1, step: 0.01, default: 0.5 },
      { key: 'serpentine', label: 'Serpentine', type: 'boolean', default: true },
    ]
  },
  {
    id: 'burkes', name: 'Burkes', category: 'error-diffusion',
    description: 'Simplified Stucki kernel. Slightly faster with comparable quality.',
    params: [
      { key: 'threshold', label: 'Threshold', type: 'range', min: 0, max: 1, step: 0.01, default: 0.5 },
      { key: 'serpentine', label: 'Serpentine', type: 'boolean', default: false },
    ]
  },
  {
    id: 'sierra', name: 'Sierra', category: 'error-diffusion',
    description: 'Three-row kernel balancing quality and speed. Produces smooth gradients.',
    params: [
      { key: 'threshold', label: 'Threshold', type: 'range', min: 0, max: 1, step: 0.01, default: 0.5 },
      { key: 'serpentine', label: 'Serpentine', type: 'boolean', default: true },
    ]
  },
  {
    id: 'bayer2', name: 'Bayer 2×2', category: 'ordered',
    description: 'Ordered dithering with a 2×2 Bayer matrix. Creates a tight crosshatch pattern.',
    params: [
      { key: 'scale', label: 'Scale', type: 'range', min: 1, max: 8, step: 1, default: 1 },
      { key: 'threshold', label: 'Threshold', type: 'range', min: 0, max: 1, step: 0.01, default: 0.5 },
    ]
  },
  {
    id: 'bayer4', name: 'Bayer 4×4', category: 'ordered',
    description: 'Ordered dithering with a 4×4 Bayer matrix. The classic screentone look.',
    params: [
      { key: 'scale', label: 'Scale', type: 'range', min: 1, max: 8, step: 1, default: 1 },
      { key: 'threshold', label: 'Threshold', type: 'range', min: 0, max: 1, step: 0.01, default: 0.5 },
    ]
  },
  {
    id: 'bayer8', name: 'Bayer 8×8', category: 'ordered',
    description: 'Ordered dithering with an 8×8 Bayer matrix. Finer pattern with more tonal gradation.',
    params: [
      { key: 'scale', label: 'Scale', type: 'range', min: 1, max: 8, step: 1, default: 1 },
      { key: 'threshold', label: 'Threshold', type: 'range', min: 0, max: 1, step: 0.01, default: 0.5 },
    ]
  },
  {
    id: 'hatch', name: 'Hatch', category: 'ordered',
    description: 'Diagonal line hatching, as seen in engraving and pen-and-ink illustration.',
    params: [
      { key: 'scale', label: 'Scale', type: 'range', min: 2, max: 16, step: 1, default: 4 },
      { key: 'threshold', label: 'Threshold', type: 'range', min: 0, max: 1, step: 0.01, default: 0.5 },
    ]
  },
  {
    id: 'halftone', name: 'Halftone', category: 'stylize',
    description: 'Circular halftone dots as seen in offset printing and comic books.',
    params: [
      { key: 'scale', label: 'Cell Size', type: 'range', min: 4, max: 32, step: 2, default: 8 },
      { key: 'angle', label: 'Angle', type: 'range', min: 0, max: 90, step: 1, default: 45, unit: '°' },
    ]
  },
  {
    id: 'riemersma', name: 'Riemersma', category: 'stylize',
    description: 'Space-filling curve dithering with exponential error history. Organic, low-noise results.',
    params: [
      { key: 'mapSize', label: 'History', type: 'range', min: 4, max: 32, step: 1, default: 16 },
      { key: 'threshold', label: 'Threshold', type: 'range', min: 0, max: 1, step: 0.01, default: 0.5 },
    ]
  },
]

export function getAlgorithm(id: AlgorithmId): AlgorithmDef {
  return ALGORITHMS.find(a => a.id === id)!
}

export function getDefaultParams(id: AlgorithmId): Record<string, number | boolean> {
  const algo = getAlgorithm(id)
  return Object.fromEntries(algo.params.map(p => [p.key, p.default]))
}
