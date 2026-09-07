import { paramsForSeed, hashSeed, type SongVisuals } from '@/components/demo/cymatic-thumb'
import type { Release } from './releases'

/**
 * The changelog's plate palette.
 *
 * `JEWELS` in cymatic-thumb.ts is the app's own six accent tokens, in the
 * order the desktop renderer indexes them, and it has to stay that way — the
 * 30px tile in the panel is meant to be pixel-for-pixel what the app draws.
 *
 * This page wants something that list cannot give it: a colour nobody else on
 * the page is already wearing, once per release, indefinitely. Six ran out at
 * six releases. So the changelog keeps its own list — the app's six, plus
 * three that fill the gaps left in the hue wheel (yellow-green, magenta,
 * burnt orange; defined alongside the others in app/globals.css).
 */
export const PLATE_JEWELS = [
  'sapphire',
  'amethyst',
  'teal',
  'emerald',
  'garnet',
  'citrine',
  'peridot',
  'tourmaline',
  'carnelian'
] as const

/**
 * The styles whose modal numbers the renderer actually reads.
 *
 * This is the whole reason the rule below has two tiers. In
 * cymatics-live.ts, only chladni and radial are drawn from `n` and `m`;
 * ripple, flow and lattice ignore both completely. So `lattice:2:6` and
 * `lattice:5:6` are different signatures that render as the same plate, and
 * treating the signature alone as "distinct enough" put two matching
 * lattices and two matching flows on the page.
 */
const MODAL_STYLES = new Set(['chladni', 'radial'])

/** Style plus the numbers that shape it — meaningful only for a modal style. */
function signature(v: SongVisuals): string {
  return `${v.style}:${v.n}:${v.m}`
}

function visualsForSeed(seed: number): SongVisuals {
  return { ...paramsForSeed(seed), jewel: PLATE_JEWELS[seed % PLATE_JEWELS.length] }
}

/**
 * 'var(--emerald)' -> 'emerald'.
 *
 * A release with no song paints from the accent written in its data, and the
 * canvas needs that as a literal token like any other jewel.
 */
export function tokenOf(accent: string): string | undefined {
  const m = /^var\(--([\w-]+)\)$/.exec(accent.trim())
  return m?.[1]
}

/**
 * Which song decides what, and how a collision is broken.
 *
 * A track key is hashed with the same FNV-1a the app runs on a track id, and
 * the hash picks a jewel, a pattern and the modal numbers. So a dispatch is
 * not wearing a colour anyone chose — it is wearing its song's.
 *
 * The catch is that a hash repeats. Two songs can land on the same jewel or
 * the same plate, which would make two letters visual twins. The rule is two
 * tiers, oldest release first:
 *
 *   1. walk the seed forward until it reaches a jewel *and a style* nobody
 *      is already wearing. While there are styles left, this is the only
 *      tier that runs, and every plate on the page is a different shape.
 *
 *   2. once the styles are gone, allow a repeated style — but only a modal
 *      one, and only with modal numbers nobody has used. A chladni at 3·4
 *      and a chladni at 5·8 really are different figures. A second lattice
 *      would not be, whatever numbers it carried.
 *
 * A letter already on the wall keeps what it was given; a newer one adapts to
 * what is there. Still deterministic, still nobody picking a colour by hand —
 * the log just refuses to repeat itself.
 *
 * If both tiers come up empty the release wears a repeat rather than nothing
 * at all. Reaching that means the nine colours are spoken for, and the page
 * has a bigger problem than this function.
 */
export function assignSongVisuals(releases: Release[]): Map<string, SongVisuals> {
  const out = new Map<string, SongVisuals>()
  const jewels: string[] = []
  const figures: string[] = []

  // A release with no song still paints the screen, using the accent written
  // in its data — and it was invisible to this function, so a song could be
  // handed a colour a songless release was already wearing. 0.1.6 is emerald
  // by hand, and widening the palette moved 0.1.0's song onto emerald too.
  // Claim those first, so the walk below has to route around them.
  for (const r of releases) {
    if (r.track) continue
    const token = tokenOf(r.accent)
    if (token) jewels.push(token)
  }

  const styles: string[] = []

  /** Walk a seed forward until `accept` is happy, or give up. */
  function walk(from: number, accept: (v: SongVisuals) => boolean): SongVisuals | null {
    let seed = from
    for (let steps = 0; steps < 512; steps++) {
      const v = visualsForSeed(seed)
      if (accept(v)) return v
      seed = (seed + 1) >>> 0
    }
    return null
  }

  // Oldest first.
  for (const r of [...releases].reverse()) {
    if (!r.track) continue

    const base = hashSeed(r.track.key)
    const free = (v: SongVisuals): boolean => !jewels.includes(v.jewel)

    const p =
      // Tier 1: a shape nobody else is wearing.
      walk(base, (v) => free(v) && !styles.includes(v.style)) ??
      // Tier 2: styles are gone, so repeat one that its numbers can actually
      // tell apart.
      walk(base, (v) => free(v) && MODAL_STYLES.has(v.style) && !figures.includes(signature(v))) ??
      visualsForSeed(base)

    jewels.push(p.jewel)
    styles.push(p.style)
    figures.push(signature(p))
    out.set(r.version, p)
  }

  return out
}

/** The CSS token a release paints with: its song's jewel, or its own accent. */
export function accentVar(r: Release, song?: SongVisuals): string {
  return song ? `var(--${song.jewel})` : r.accent
}
