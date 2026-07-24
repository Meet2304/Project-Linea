import type { FieldStyle } from '@/components/field/cymatics-live'

/**
 * Duotone palettes. The field sweeps c1 → c2; `accent` is the harmonizing
 * UI color for type and rules. Ported from the design project's plate hero,
 * with the jewel-derived pairs matching the app's own accent tokens.
 */
export interface Palette {
  id: string
  name: string
  c1: string
  c2: string
  accent: string
  /** Mono flourish. Texture, not a claim. */
  hz: string
}

export const PALETTES = {
  ink: { id: 'ink', name: 'Ink', c1: '#1a1a1e', c2: '#454550', accent: '#1a1a1e', hz: '432 hz' },
  iris: { id: 'iris', name: 'Iris', c1: '#7a6bc4', c2: '#b072b4', accent: '#6d5b9e', hz: '396 hz' },
  tide: { id: 'tide', name: 'Tide', c1: '#3f7fb8', c2: '#4bb0ac', accent: '#3a6098', hz: '440 hz' },
  dusk: { id: 'dusk', name: 'Dusk', c1: '#e0714a', c2: '#c05a86', accent: '#9a4552', hz: '528 hz' },
  fern: { id: 'fern', name: 'Fern', c1: '#4f9e7a', c2: '#93b061', accent: '#3a7a5c', hz: '639 hz' },
  teal: { id: 'teal', name: 'Teal', c1: '#2f7d7a', c2: '#5fada9', accent: '#2f7d7a', hz: '741 hz' }
} as const satisfies Record<string, Palette>

export type PaletteId = keyof typeof PALETTES

/** A named plate: a field style plus the modal numbers that shape it. */
export interface Pattern {
  style: FieldStyle
  n?: number
  m?: number
  scale: number
  seed: number
  /** Mono label, e.g. "mode 5·4". */
  label: string
}

// Annotated rather than `as const` so every entry keeps the optional `n`/`m`
// on its type — the ripple/flow/lattice plates have no modal numbers, and
// callers spread the same props for all of them.
export const PATTERNS: Record<string, Pattern> = {
  /** A tight lattice of nodes — the brand's default plate. */
  weave: { style: 'chladni', n: 5, m: 4, scale: 1.55, seed: 7, label: 'mode 5·4' },
  /** A calm, open plate. */
  quartet: { style: 'chladni', n: 3, m: 2, scale: 1.5, seed: 4, label: 'mode 3·2' },
  /** An off-balance standing wave. */
  drift: { style: 'chladni', n: 3, m: 8, scale: 1.6, seed: 2, label: 'mode 3·8' },
  /** A circular singing plate. */
  bloom: { style: 'radial', n: 4, m: 6, scale: 1.7, seed: 5, label: 'radial 4·6' },
  /** A rosette of nodal petals. */
  star: { style: 'radial', n: 3, m: 10, scale: 1.8, seed: 9, label: 'radial 3·10' },
  ripple: { style: 'ripple', scale: 1.6, seed: 3, label: 'interference' },
  flow: { style: 'flow', scale: 1.5, seed: 11, label: 'advection' },
  lattice: { style: 'lattice', scale: 1.5, seed: 6, label: 'grid' }
}

/**
 * Base field settings shared by every plate on the page.
 *
 * `speed` and `ringSpeed` are independent on purpose. The plate runs fast
 * enough that the page always feels like something is playing; the ring
 * under the cursor stays slow so the interaction reads as a swell you
 * notice rather than a pulse that grabs at you.
 */
export const FIELD_BASE = {
  density: 5,
  dither: 0.5,
  opacity: 0.58,
  fade: false,
  ptAmt: 0.5,
  speed: 7,
  ringSpeed: 0.5,
  ringAmp: 0.12,
  ptWarp: 0.25,
  quality: 0.44
} as const
