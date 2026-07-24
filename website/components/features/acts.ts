import type { DemoAct } from '../demo/OverlayDemo'
import { PALETTES, PATTERNS, type Palette, type Pattern } from '@/lib/palettes'

export interface Act {
  id: DemoAct
  /** Two-digit section number, mono. */
  n: string
  eyebrow: string
  title: string
  body: string
  /** Short supporting points — the specifics a GitHub audience wants. */
  points: string[]
  /** Honest caveat where one exists. Rendered small and quiet. */
  note?: string
  palette: Palette
  pattern: Pattern
}

/**
 * Four acts, each pairing one feature with its own plate and palette. The
 * copy comes from the app's actual behavior — nothing here is aspirational.
 * Click-through and the summon shortcut are deliberately left out; they live
 * in the README rather than on the page.
 */
export const ACTS: Act[] = [
  {
    id: 'lyrics',
    n: '01',
    eyebrow: '// live lyrics',
    title: 'The words, in time',
    body: 'Timestamped lyrics from lrclib, lit line by line as the song moves. The current line stays centered, so you can glance down and be exactly where the music is.',
    points: [
      'Scroll ahead to read on — the “Now” chip brings you back in one tap',
      'Optional timestamps beside every line',
      'Lyrics cache to disk, so a track you have played before loads instantly'
    ],
    note: 'Coverage depends on lrclib. Not every track has synced lyrics.',
    palette: PALETTES.iris,
    pattern: PATTERNS.weave
  },
  {
    id: 'transport',
    n: '02',
    eyebrow: '// playback',
    title: 'Controls that stay on top',
    body: 'Play, pause, skip, scrub, shuffle and repeat from a surface that floats above every window. The controls stay invisible until you reach for them.',
    points: [
      'The progress hairline along the panel edge becomes the scrubber on hover',
      'Click anywhere on the panel to play or pause',
      'Drag the top bar to move it, any edge or corner to resize'
    ],
    note: 'Playback control requires Spotify Premium. Lyrics work on any account.',
    palette: PALETTES.tide,
    pattern: PATTERNS.ripple
  },
  {
    id: 'tile',
    n: '03',
    eyebrow: '// cymatics',
    title: 'A shape for every song',
    body: 'Instead of album art, Linea draws a standing wave. The track seeds the pattern and the color, so every song arrives looking like itself — and keeps moving while it plays.',
    points: [
      'Pure math on a canvas, run through an ordered dither — never an image',
      'The track’s color carries through the lyrics, the hairline and the scrubber',
      'It evolves while playing and holds still when paused'
    ],
    palette: PALETTES.ink,
    pattern: PATTERNS.bloom
  },
  {
    id: 'yours',
    n: '04',
    eyebrow: '// make it yours',
    title: 'Quiet, the way you want it',
    body: 'A pure-white layer or near-black glass. Three lyric sizes with a live preview, so you can set it once from across the room and forget about it.',
    points: [
      'Light and dark, one toggle away',
      'Small, medium and large — the window resizes to match',
      'Pin it on top, or let it fall behind while you work'
    ],
    palette: PALETTES.dusk,
    pattern: PATTERNS.drift
  }
]
