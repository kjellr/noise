export type PaletteId = 'mono' | 'gray2' | 'gray4' | 'custom' | 'cga' | 'gameboy' | 'pico8'

export interface PaletteDef {
  id: PaletteId
  name: string
  colors: [number, number, number][]
}

export const PALETTES: PaletteDef[] = [
  { id: 'mono', name: 'Mono', colors: [[0,0,0],[255,255,255]] },
  { id: 'gray2', name: '2-bit', colors: [[0,0,0],[85,85,85],[170,170,170],[255,255,255]] },
  { id: 'gray4', name: '4-bit', colors: Array.from({length:16}, (_,i) => { const v = Math.round(i*255/15); return [v,v,v] as [number,number,number] }) },
  { id: 'cga', name: 'CGA', colors: [[0,0,0],[0,170,170],[170,0,170],[170,170,170]] },
  { id: 'gameboy', name: 'Game Boy', colors: [[15,56,15],[48,98,48],[139,172,15],[155,188,15]] },
  { id: 'pico8', name: 'PICO-8', colors: [[0,0,0],[29,43,83],[126,37,83],[0,135,81],[171,82,54],[95,87,79],[194,195,199],[255,241,232],[255,0,77],[255,163,0],[255,236,39],[0,228,54],[41,173,255],[131,118,156],[255,119,168],[255,204,170]] },
  { id: 'custom', name: 'Custom', colors: [[0,0,0],[255,255,255]] },
]

function hexToRgb(hex: string): [number, number, number] {
  const r = parseInt(hex.slice(1,3), 16)
  const g = parseInt(hex.slice(3,5), 16)
  const b = parseInt(hex.slice(5,7), 16)
  return [r, g, b]
}

export function getPalette(id: PaletteId, colorA?: string, colorB?: string): [number,number,number][] {
  if (id === 'custom' && colorA && colorB) {
    return [hexToRgb(colorB), hexToRgb(colorA)]
  }
  return PALETTES.find(p => p.id === id)!.colors
}
