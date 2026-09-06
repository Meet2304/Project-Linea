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
 * What makes two plates look like each other.
 *
 * Style alone is too coarse. There are only four of them, so the fourth
 * tracked release exhausted the pool and the fifth gave up and repeated one.
 * The figure a plate draws is its style *and* its modal numbers — a chladni
 * at 3·4 and a chladni at 5·8 are not the same plate — so uniqueness is
 * checked against all three. That is 4 x 5 x 6 = 120 distinct figures, which
 * is not a ceiling anyone is going to reach by shipping.
 */
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
 * The catch is that a hash repeats. Two songs can land on the same jewel, or
 * on the same figure, which would make two letters visual twins. The rule:
 *
 *   assign oldest first, and walk a later seed forward one step at a time
 *   until it reaches a jewel *and* a figure nobody is already wearing.
 *
 * A letter already on the wall keeps what it was given; a newer one adapts to
 * what is there. Still deterministic, still nobody picking a colour by hand —
 * the log just refuses to repeat itself.
 *
 * The walk gives up after 256 steps rather than looping forever. It should
 * never come to that: reaching it would mean nine colours or a hundred and
 * twenty figures are all spoken for, and the page has a bigger problem than
 * this function. If it ever does, the release wears a repeat rather than
 * nothing at all.
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

  // Oldest first.
  for (const r of [...releases].reverse()) {
    if (!r.track) continue

    let seed = hashSeed(r.track.key)
    let p = visualsForSeed(seed)
    let steps = 0

    while ((jewels.includes(p.jewel) || figures.includes(signature(p))) && steps < 256) {
      seed = (seed + 1) >>> 0
      p = visualsForSeed(seed)
      steps++
    }

    jewels.push(p.jewel)
    figures.push(signature(p))
    out.set(r.version, p)
  }

  return out
}

/** The CSS token a release paints with: its song's jewel, or its own accent. */
export function accentVar(r: Release, song?: SongVisuals): string {
  return song ? `var(--${song.jewel})` : r.accent
}
