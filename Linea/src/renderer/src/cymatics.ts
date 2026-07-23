/**
 * Cymatics — procedural standing-wave patterns with ordered dither,
 * vendored from the Linea Design System (`assets/cymatics.js`).
 * Pure per-pixel math; expensive relative to everything else in the
 * renderer, so callers render once per (track, theme) and cache.
 * The field math is canvas-free so it can be unit-tested in node.
 */

export type CymaticStyle = 'ripple' | 'chladni' | 'flow' | 'lattice'

export interface CymaticOptions {
  style: CymaticStyle
  /** Hex color like #2f7d7a. */
  color: string
  density?: number
  /** 0 smooth … 1 heavy grain. */
  dither?: number
  scale?: number
  seed?: number
  /** Radial vignette toward edges. */
  fade?: boolean
  /** Animation phase (radians); 0 is the still frame. */
  phase?: number
}

// 8x8 ordered Bayer matrix → normalized thresholds
const BAYER8 = [
  0, 48, 12, 60, 3, 51, 15, 63, 32, 16, 44, 28, 35, 19, 47, 31, 8, 56, 4, 52, 11, 59, 7, 55, 40, 24,
  36, 20, 43, 27, 39, 23, 2, 50, 14, 62, 1, 49, 13, 61, 34, 18, 46, 30, 33, 17, 45, 29, 10, 58, 6,
  54, 9, 57, 5, 53, 42, 26, 38, 22, 41, 25, 37, 21
].map((v) => (v + 0.5) / 64)

/** FNV-1a hash — stable seed from a track id. */
export function hashSeed(input: string): number {
  let hash = 0x811c9dc5
  for (let i = 0; i < input.length; i++) {
    hash ^= input.charCodeAt(i)
    hash = Math.imul(hash, 0x01000193)
  }
  return hash >>> 0
}

function mulberry32(a: number): () => number {
  return () => {
    a |= 0
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

function hexToRgb(hex: string): { r: number; g: number; b: number } {
  let h = hex.trim().replace('#', '')
  if (h.length === 3) h = [...h].map((c) => c + c).join('')
  const n = parseInt(h, 16)
  return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 }
}

interface RippleSource {
  x: number
  y: number
  f: number
}

interface FlowPhases {
  p1: number
  p2: number
  p3: number
  p4: number
  p5: number
}

function fieldRipple(
  x: number,
  y: number,
  sources: RippleSource[],
  k: number,
  phase: number
): number {
  let v = 0
  for (const s of sources) {
    const dx = x - s.x
    const dy = y - s.y
    const d = Math.sqrt(dx * dx + dy * dy)
    v += Math.cos(d * k * s.f - phase) / (1 + d * 0.6)
  }
  return v / Math.sqrt(sources.length)
}

function fieldChladni(x: number, y: number, n: number, m: number, phase: number): number {
  const a = Math.cos(n * Math.PI * x + phase * 0.3) * Math.cos(m * Math.PI * y + phase * 0.2)
  const b = Math.cos(m * Math.PI * x - phase * 0.2) * Math.cos(n * Math.PI * y - phase * 0.3)
  return a - b
}

function fieldLattice(x: number, y: number, n: number, phase: number): number {
  return (Math.cos(x * n * Math.PI + phase) + Math.cos(y * n * Math.PI + phase)) * 0.5
}

function fieldFlow(x: number, y: number, p: FlowPhases, warp: number, phase: number): number {
  const wx = x + Math.sin(y * 2.3 + p.p1 + phase) * warp
  const wy = y + Math.cos(x * 2.1 + p.p2 + phase) * warp
  return (
    Math.sin(wx * 3.1 + p.p3 + phase) * 0.6 +
    Math.sin((wx + wy) * 2.2 + p.p4) * 0.4 +
    Math.cos(wy * 4.0 - p.p5) * 0.3
  )
}

/**
 * Render the dithered field to a raw RGBA buffer (canvas-free).
 */
export function renderPixels(
  width: number,
  height: number,
  opts: CymaticOptions
): Uint8ClampedArray<ArrayBuffer> {
  const color = hexToRgb(opts.color)
  const density = opts.density ?? 6
  const dither = opts.dither ?? 0.45
  const scale = opts.scale ?? 1.6
  const seed = opts.seed ?? 7
  const fade = opts.fade ?? true
  const phase = opts.phase ?? 0

  const data = new Uint8ClampedArray(new ArrayBuffer(width * height * 4))
  const rand = mulberry32(seed)
  const phases: FlowPhases = {
    p1: rand() * 6.28,
    p2: rand() * 6.28,
    p3: rand() * 6.28,
    p4: rand() * 6.28,
    p5: rand() * 6.28
  }
  const sources: RippleSource[] = []
  const srcN = Math.max(2, Math.round(density * 0.6))
  for (let s = 0; s < srcN; s++) {
    sources.push({ x: (rand() * 2 - 1) * 0.9, y: (rand() * 2 - 1) * 0.9, f: 0.8 + rand() * 0.6 })
  }
  const chN = 2 + (density % 5)
  const chM = 3 + ((density + 2) % 6)
  const k = density * 2.4
  const warp = 0.35

  const band = 0.06 + dither * 0.9
  const cx = width / 2
  const cy = height / 2
  const maxR = Math.sqrt(cx * cx + cy * cy)

  for (let py = 0; py < height; py++) {
    for (let px = 0; px < width; px++) {
      const nx = ((px / width) * 2 - 1) * scale * (width > height ? width / height : 1)
      const ny = ((py / height) * 2 - 1) * scale * (height > width ? height / width : 1)

      let val: number
      if (opts.style === 'chladni') {
        val = Math.abs(fieldChladni(nx * 0.5, ny * 0.5, chN, chM, phase))
        val = 1 - Math.min(1, val * 2.2)
      } else if (opts.style === 'lattice') {
        val = Math.abs(fieldLattice(nx, ny, density, phase))
      } else if (opts.style === 'flow') {
        val = (fieldFlow(nx, ny, phases, warp, phase) + 1) * 0.5
      } else {
        val = (fieldRipple(nx, ny, sources, k, phase) + 1) * 0.5
      }

      if (fade) {
        const dxr = px - cx
        const dyr = py - cy
        const rr = Math.sqrt(dxr * dxr + dyr * dyr) / maxR
        val *= Math.max(0, 1 - Math.pow(rr, 1.7))
      }

      const t = BAYER8[(py & 7) * 8 + (px & 7)]
      const edge = (val - (t - 0.5) * band - 0.5) / Math.max(0.0001, band)
      const cov = dither < 0.15 ? Math.max(0, Math.min(1, edge + 0.5)) : edge > 0 ? 1 : 0

      const idx = (py * width + px) * 4
      data[idx] = color.r
      data[idx + 1] = color.g
      data[idx + 2] = color.b
      data[idx + 3] = Math.round(cov * 255)
    }
  }
  return data
}

const STYLES: CymaticStyle[] = ['ripple', 'chladni', 'flow', 'lattice']

/** Deterministic per-track pattern style. */
export function styleForSeed(seed: number): CymaticStyle {
  return STYLES[seed % STYLES.length]
}

const cache = new Map<string, ImageData>()
const CACHE_MAX = 8

/**
 * Draw the cymatic art for a track onto a canvas, cached per
 * (trackId, theme) so a render happens at most once per track change.
 */
export function renderTrackArt(
  canvas: HTMLCanvasElement,
  trackId: string,
  theme: string,
  color: string
): void {
  const key = `${trackId}:${theme}`
  const ctx = canvas.getContext('2d')
  if (!ctx) return

  let image = cache.get(key)
  if (!image) {
    const seed = hashSeed(trackId)
    const pixels = renderPixels(canvas.width, canvas.height, {
      style: styleForSeed(seed),
      color,
      seed: seed % 100000,
      density: 4 + (seed % 5),
      dither: 0.5,
      scale: 1.8
    })
    image = new ImageData(pixels, canvas.width, canvas.height)
    if (cache.size >= CACHE_MAX) {
      const oldest = cache.keys().next().value
      if (oldest !== undefined) cache.delete(oldest)
    }
    cache.set(key, image)
  }
  ctx.clearRect(0, 0, canvas.width, canvas.height)
  ctx.putImageData(image, 0, 0)
}

/** Clear cached art (theme switches invalidate colors). */
export function clearArtCache(): void {
  cache.clear()
}

/**
 * Small cymatic thumbnail beside the track title. Pattern (style +
 * geometry) is seeded from the track and hue is the caller's per-track
 * jewel, so every song looks distinct; `phase` animates it so it evolves
 * while the song plays. Cheap enough (small canvas) to redraw per frame.
 */
export function renderThumb(
  canvas: HTMLCanvasElement,
  seedKey: string,
  color: string,
  phase: number
): void {
  const ctx = canvas.getContext('2d')
  if (!ctx || canvas.width === 0 || canvas.height === 0) return
  const seed = hashSeed(seedKey || 'linea')
  const pixels = renderPixels(canvas.width, canvas.height, {
    style: styleForSeed(seed),
    color,
    seed: seed % 100000,
    density: 4 + (seed % 4),
    dither: 0.28,
    scale: 1.5,
    fade: true,
    phase
  })
  ctx.clearRect(0, 0, canvas.width, canvas.height)
  ctx.putImageData(new ImageData(pixels, canvas.width, canvas.height), 0, 0)
}
