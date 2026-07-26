/**
 * Per-track cymatic thumbnail.
 *
 * Vendored from Linea/src/renderer/src/cymatics.ts so the tile on this page
 * is pixel-for-pixel what the app draws: same Bayer dither, same FNV-1a
 * seeding, same `renderThumb` parameters. If the app's version changes,
 * change this one with it.
 */

export type CymaticStyle = 'ripple' | 'chladni' | 'flow' | 'lattice'

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
  if (h.length === 3)
    h = h
      .split('')
      .map((c) => c + c)
      .join('')
  const n = parseInt(h, 16)
  return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 }
}

const STYLES: CymaticStyle[] = ['ripple', 'chladni', 'flow', 'lattice']

/** Deterministic per-track pattern style. */
export function styleForSeed(seed: number): CymaticStyle {
  return STYLES[seed % STYLES.length]
}

/**
 * The six jewel tokens, in the order the app's renderer indexes them.
 * A track's hash picks one, and it becomes --lyric-accent for the whole panel.
 */
export const JEWELS = [
  '--sapphire',
  '--amethyst',
  '--teal',
  '--emerald',
  '--garnet',
  '--citrine'
] as const

export function jewelForTrack(trackId: string): (typeof JEWELS)[number] {
  return JEWELS[hashSeed(trackId) % JEWELS.length]
}

export interface SongVisuals {
  /** The seed everything below was derived from — possibly walked. */
  seed: number
  /** Jewel token name, without the leading `--`. */
  jewel: string
  style: CymaticStyle
  density: number
  /** Modal numbers for a full-size plate, as opposed to a 64px tile. */
  n: number
  m: number
}

/**
 * Everything a track decides about how something looks. The changelog uses
 * this to let a song pick a release's colour and plate rather than anyone
 * choosing one by hand.
 */
export function paramsForSeed(seed: number): SongVisuals {
  return {
    seed,
    jewel: JEWELS[seed % JEWELS.length].slice(2),
    style: STYLES[seed % STYLES.length],
    density: 4 + (seed % 4),
    n: 2 + (seed % 5),
    m: 3 + ((seed + 2) % 6)
  }
}

export function paramsForTrack(trackId: string): SongVisuals {
  return paramsForSeed(hashSeed(trackId))
}

interface ThumbOptions {
  color: string
  density: number
  dither: number
  scale: number
  seed: number
  fade: boolean
  phase: number
  style: CymaticStyle
}

function renderPixels(
  width: number,
  height: number,
  o: ThumbOptions,
  out: Uint8ClampedArray
): void {
  const color = hexToRgb(o.color)
  const rand = mulberry32(o.seed)
  const phases = {
    p1: rand() * 6.28,
    p2: rand() * 6.28,
    p3: rand() * 6.28,
    p4: rand() * 6.28,
    p5: rand() * 6.28
  }

  const sources: { x: number; y: number; f: number }[] = []
  const srcN = Math.max(2, Math.round(o.density * 0.6))
  for (let s = 0; s < srcN; s++) {
    sources.push({ x: (rand() * 2 - 1) * 0.9, y: (rand() * 2 - 1) * 0.9, f: 0.8 + rand() * 0.6 })
  }

  const chN = 2 + (o.density % 5)
  const chM = 3 + ((o.density + 2) % 6)
  const k = o.density * 2.4
  const warp = 0.35
  const band = 0.06 + o.dither * 0.9
  const cx = width / 2
  const cy = height / 2
  const maxR = Math.sqrt(cx * cx + cy * cy)
  const phase = o.phase

  for (let py = 0; py < height; py++) {
    for (let px = 0; px < width; px++) {
      const nx = ((px / width) * 2 - 1) * o.scale * (width > height ? width / height : 1)
      const ny = ((py / height) * 2 - 1) * o.scale * (height > width ? height / width : 1)

      let val: number
      if (o.style === 'chladni') {
        const hx = nx * 0.5
        const hy = ny * 0.5
        const a =
          Math.cos(chN * Math.PI * hx + phase * 0.3) * Math.cos(chM * Math.PI * hy + phase * 0.2)
        const b =
          Math.cos(chM * Math.PI * hx - phase * 0.2) * Math.cos(chN * Math.PI * hy - phase * 0.3)
        val = 1 - Math.min(1, Math.abs(a - b) * 2.2)
      } else if (o.style === 'lattice') {
        val = Math.abs(
          (Math.cos(nx * o.density * Math.PI + phase) +
            Math.cos(ny * o.density * Math.PI + phase)) *
            0.5
        )
      } else if (o.style === 'flow') {
        const wx = nx + Math.sin(ny * 2.3 + phases.p1 + phase) * warp
        const wy = ny + Math.cos(nx * 2.1 + phases.p2 + phase) * warp
        const v =
          Math.sin(wx * 3.1 + phases.p3 + phase) * 0.6 +
          Math.sin((wx + wy) * 2.2 + phases.p4) * 0.4 +
          Math.cos(wy * 4.0 - phases.p5) * 0.3
        val = (v + 1) * 0.5
      } else {
        let v = 0
        for (const s of sources) {
          const dx = nx - s.x
          const dy = ny - s.y
          const d = Math.sqrt(dx * dx + dy * dy)
          v += Math.cos(d * k * s.f - phase) / (1 + d * 0.6)
        }
        val = (v / Math.sqrt(sources.length) + 1) * 0.5
      }

      if (o.fade) {
        const dxr = px - cx
        const dyr = py - cy
        const rr = Math.sqrt(dxr * dxr + dyr * dyr) / maxR
        val *= Math.max(0, 1 - Math.pow(rr, 1.7))
      }

      const t = BAYER8[(py & 7) * 8 + (px & 7)]
      const edge = (val - (t - 0.5) * band - 0.5) / Math.max(0.0001, band)
      const cov = o.dither < 0.15 ? Math.max(0, Math.min(1, edge + 0.5)) : edge > 0 ? 1 : 0

      const idx = (py * width + px) * 4
      out[idx] = color.r
      out[idx + 1] = color.g
      out[idx + 2] = color.b
      out[idx + 3] = Math.round(cov * 255)
    }
  }
}

/**
 * Draw the animated thumbnail. Parameters match the app's `renderThumb`:
 * dither 0.28, scale 1.5, density 4 + (seed % 4), fade on.
 */
export function drawThumb(
  canvas: HTMLCanvasElement,
  seedKey: string,
  color: string,
  phase: number,
  scratch: { buf: Uint8ClampedArray; image: ImageData } | null,
  /**
   * Overrides the seed derived from `seedKey`. The changelog walks a seed
   * forward when two songs collide on a jewel; the tile has to walk with it
   * or the tile and the plate behind it disagree.
   */
  seedOverride?: number
): { buf: Uint8ClampedArray; image: ImageData } | null {
  const ctx = canvas.getContext('2d')
  if (!ctx || canvas.width === 0 || canvas.height === 0) return scratch

  let s = scratch
  if (!s || s.image.width !== canvas.width || s.image.height !== canvas.height) {
    const buf = new Uint8ClampedArray(canvas.width * canvas.height * 4)
    s = { buf, image: new ImageData(buf, canvas.width, canvas.height) }
  }

  const seed = seedOverride ?? hashSeed(seedKey || 'linea')
  renderPixels(
    canvas.width,
    canvas.height,
    {
      style: styleForSeed(seed),
      color,
      seed: seed % 100000,
      density: 4 + (seed % 4),
      dither: 0.28,
      scale: 1.5,
      fade: true,
      phase
    },
    s.buf
  )

  ctx.clearRect(0, 0, canvas.width, canvas.height)
  ctx.putImageData(s.image, 0, 0)
  return s
}
