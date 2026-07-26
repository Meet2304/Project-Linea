import { paramsForSeed, hashSeed, type SongVisuals } from '@/components/demo/cymatic-thumb'
import type { Release } from './releases'

/**
 * Which song decides what, and how a collision is broken.
 *
 * A track key is hashed with the same FNV-1a the app runs on a Spotify track
 * id, and the hash picks a jewel, a pattern and the modal numbers. So a
 * dispatch is not wearing a colour anyone chose — it is wearing its song's.
 *
 * The catch is that a hash picks one jewel out of six, so two songs can land
 * on the same one. Both of the current tracks do, which would have made the
 * two letters visual twins. The rule:
 *
 *   assign oldest first, and walk a later seed forward one step at a time
 *   until it reaches a jewel *and* a pattern nobody is already wearing.
 *
 * A letter already on the wall keeps what it was given; a newer one adapts to
 * what is there. Still deterministic, still nobody picking a colour by hand —
 * the log just refuses to repeat itself.
 */
export function assignSongVisuals(releases: Release[]): Map<string, SongVisuals> {
  const out = new Map<string, SongVisuals>()
  const jewels: string[] = []
  const styles: string[] = []

  // Oldest first.
  for (const r of [...releases].reverse()) {
    if (!r.track) continue

    let seed = hashSeed(r.track.key)
    let p = paramsForSeed(seed)
    let steps = 0

    while ((jewels.includes(p.jewel) || styles.includes(p.style)) && steps < 256) {
      seed = (seed + 1) >>> 0
      p = paramsForSeed(seed)
      steps++
    }

    jewels.push(p.jewel)
    styles.push(p.style)
    out.set(r.version, p)
  }

  return out
}

/** The CSS token a release paints with: its song's jewel, or its own accent. */
export function accentVar(r: Release, song?: SongVisuals): string {
  return song ? `var(--${song.jewel})` : r.accent
}
