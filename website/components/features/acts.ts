import type { DemoAct } from '../demo/OverlayDemo'
import { PALETTES, PATTERNS, type Palette, type Pattern } from '@/lib/palettes'

export interface Act {
  id: DemoAct
  /** Two-digit section number, mono. */
  n: string
  eyebrow: string
  title: string
  /** One or two short sentences. Resist adding a third. */
  body: string
  /** Three at most, a few words each — these are glanced at, not read. */
  points: string[]
  /** Honest caveat where one exists. Rendered small and quiet. */
  note?: string
  palette: Palette
  pattern: Pattern
  /**
   * Invert the whole page while this act is on screen, then hand the
   * visitor's theme back when it scrolls away.
   */
  invertsTheme?: boolean
}

/**
 * Four acts, each pairing one feature with its own plate and palette.
 * Everything here describes what the app actually does.
 *
 * Click-through and the summon shortcut are deliberately left out; they
 * live in the README rather than on the page.
 */
export const ACTS: Act[] = [
  {
    id: 'lyrics',
    n: '01',
    eyebrow: '// live lyrics',
    title: 'Never lose your place',
    body: 'Lyrics move with the song. Your line stays centered.',
    points: ['Scroll ahead, tap once to return', 'Timestamps if you want them'],
    note: 'Lyrics come from lrclib — not every track has them.',
    palette: PALETTES.iris,
    pattern: PATTERNS.weave
  },
  {
    id: 'transport',
    n: '02',
    eyebrow: '// playback',
    title: 'Skip a track without leaving',
    body: 'Play, pause and scrub without switching windows.',
    points: ['Sits above every window', 'Click anywhere to pause'],
    note: 'Control needs Spotify Premium — lyrics work on any plan.',
    palette: PALETTES.tide,
    pattern: PATTERNS.ripple
  },
  {
    id: 'tile',
    n: '03',
    eyebrow: '// cymatics',
    title: 'Every song gets a shape',
    body: 'No album art — each track is drawn live as a standing wave.',
    points: ['Unique to every song', 'Never an image'],
    palette: PALETTES.ink,
    pattern: PATTERNS.bloom
  },
  {
    id: 'yours',
    n: '04',
    eyebrow: '// light & dark',
    title: 'Two looks, your call',
    // The page flips to whichever mode the visitor is *not* in while this
    // act is on screen, so the copy has to read true in either direction.
    body: 'You’re looking at the other side right now — Linea wears whichever you pick.',
    points: ['Three lyric sizes', 'Pin it, or let it fall behind'],
    palette: PALETTES.dusk,
    pattern: PATTERNS.drift,
    // Shows the visitor the mode they are not in, then gives theirs back.
    invertsTheme: true
  }
]
