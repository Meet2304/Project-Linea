/**
 * Canned playlist for the overlay demo.
 *
 * The real app pulls timestamped LRC from lrclib.net. Shipping actual song
 * lyrics on a marketing page would mean redistributing someone else's
 * copyrighted text, so every track and every line below is original writing
 * for this demo — fictional songs by fictional artists, in the brand's voice.
 * The *shape* of the data (ms timestamps, one line per cue) is exactly what
 * the renderer consumes.
 */

export interface LyricLine {
  /** Milliseconds from the start of the track. */
  t: number
  text: string
}

export interface DemoTrack {
  /** Stands in for a Spotify track id — seeds the pattern and jewel accent. */
  id: string
  title: string
  artist: string
  durationMs: number
  lines: LyricLine[]
}

export const TRACKS: DemoTrack[] = [
  {
    id: 'linea-demo-still-water',
    title: 'Still Water',
    artist: 'Hollow Coast',
    durationMs: 227_000,
    lines: [
      { t: 0, text: 'Still water, still morning' },
      { t: 6_400, text: 'the room has not decided yet' },
      { t: 12_900, text: 'what kind of day it wants to be' },
      { t: 19_600, text: 'so I let it stay undecided' },
      { t: 26_800, text: 'and I put a record on' },
      { t: 33_200, text: 'Something with a low ceiling' },
      { t: 39_900, text: 'something that knows how to wait' },
      { t: 46_700, text: 'The kettle finds the note first' },
      { t: 53_400, text: 'and everything else agrees' },
      { t: 60_800, text: 'Sand on a plate, finding the line' },
      { t: 68_000, text: 'the shape was always there' },
      { t: 75_100, text: 'we only needed something to sing' },
      { t: 82_600, text: 'Still water, still morning' },
      { t: 89_400, text: 'and nothing asking to be solved' },
      { t: 96_800, text: 'I have the whole thing to myself' },
      { t: 104_200, text: 'and the whole thing has me' }
    ]
  },
  {
    id: 'linea-demo-paper-lantern',
    title: 'Paper Lantern',
    artist: 'Ivy & the Long Room',
    durationMs: 198_000,
    lines: [
      { t: 0, text: 'You left a light on in the hallway' },
      { t: 7_200, text: 'a small one, the kind that means come back' },
      { t: 14_600, text: 'I have been circling the block' },
      { t: 21_300, text: 'rehearsing what I meant to say' },
      { t: 28_900, text: 'A paper lantern in the rain' },
      { t: 35_800, text: 'holding its shape anyway' },
      { t: 43_100, text: 'That is all I ever wanted to be' },
      { t: 50_400, text: 'Bright, and not built to last' },
      { t: 58_200, text: 'and still worth carrying home' },
      { t: 66_000, text: 'You left a light on in the hallway' },
      { t: 73_500, text: 'I am taking that as a yes' }
    ]
  },
  {
    id: 'linea-demo-north-window',
    title: 'North Window',
    artist: 'Field Notes',
    durationMs: 241_000,
    lines: [
      { t: 0, text: 'Winter gets in through the north window' },
      { t: 7_800, text: 'the way an old song gets in' },
      { t: 15_200, text: 'sideways, and without knocking' },
      { t: 22_600, text: 'I have stopped trying to close it' },
      { t: 30_400, text: 'Some cold is worth the view' },
      { t: 38_100, text: 'Frost writes the same word every night' },
      { t: 45_900, text: 'and every morning takes it back' },
      { t: 53_600, text: 'I think that is a kind of patience' },
      { t: 61_200, text: 'I think that is a kind of love' },
      { t: 69_400, text: 'Winter gets in through the north window' },
      { t: 77_000, text: 'and I let it have the chair' }
    ]
  }
]

/** Index of the line active at `ms`, or -1 before the first cue. */
export function activeLineIndex(lines: LyricLine[], ms: number): number {
  let lo = 0
  let hi = lines.length - 1
  let found = -1
  while (lo <= hi) {
    const mid = (lo + hi) >> 1
    if (lines[mid].t <= ms) {
      found = mid
      lo = mid + 1
    } else {
      hi = mid - 1
    }
  }
  return found
}

export function formatTime(ms: number): string {
  const total = Math.max(0, Math.floor(ms / 1000))
  const m = Math.floor(total / 60)
  const s = total % 60
  return `${m}:${String(s).padStart(2, '0')}`
}

/** `[mm:ss.cc]` — the LRC timestamp the app can optionally show per line. */
export function formatLrcStamp(ms: number): string {
  const total = Math.max(0, ms)
  const m = Math.floor(total / 60_000)
  const s = Math.floor((total % 60_000) / 1000)
  return `${m}:${String(s).padStart(2, '0')}`
}
