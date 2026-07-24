/**
 * The demo track.
 *
 * The song is "Indigo" by Henry Moodie. Its lyrics are **not** stored here:
 * they are fetched from lrclib.net at request time by /api/lyrics, which is
 * exactly what the desktop app does (Linea/src/main/lyrics.ts). Song lyrics
 * are copyrighted, and committing a full set to a public repo — then serving
 * it from our own origin — would be redistribution rather than a demo.
 *
 * FALLBACK below is original writing, used only when lrclib has no synced
 * match or the request fails, so the panel is never empty.
 */

export interface LyricLine {
  /** Milliseconds from the start of the track. */
  t: number
  text: string
}

export interface DemoTrack {
  /** Seeds the thumbnail's pattern, standing in for a Spotify track id. */
  id: string
  title: string
  artist: string
  durationMs: number
  lines: LyricLine[]
}

/** Original placeholder lines. Not the real song. */
const FALLBACK: LyricLine[] = [
  { t: 0, text: 'Loading the words…' },
  { t: 4_000, text: 'Linea pulls synced lyrics from lrclib' },
  { t: 9_000, text: 'the same way the app does' },
  { t: 14_000, text: 'and lines them up with the song' },
  { t: 19_000, text: 'so you never lose your place' },
  { t: 24_000, text: 'Open it, and forget it is there' }
]

export const DEMO_TRACK: DemoTrack = {
  id: 'henry-moodie-indigo',
  title: 'Indigo',
  artist: 'Henry Moodie',
  durationMs: 168_000,
  lines: FALLBACK
}

/** Every track the demo can show. One, for now. */
export const TRACKS: DemoTrack[] = [DEMO_TRACK]

/**
 * Parse an LRC body into timestamped lines.
 * Mirrors the app's own parser: `[mm:ss.xx]` prefixes, blank cues dropped.
 */
export function parseLrc(lrc: string): LyricLine[] {
  const out: LyricLine[] = []
  const stamp = /\[(\d{1,3}):(\d{2})(?:[.:](\d{1,3}))?\]/g

  for (const raw of lrc.split(/\r?\n/)) {
    stamp.lastIndex = 0
    const stamps: number[] = []
    let match: RegExpExecArray | null

    while ((match = stamp.exec(raw)) !== null) {
      const min = Number(match[1])
      const sec = Number(match[2])
      // A 2-digit fraction is centiseconds, 3 is milliseconds.
      const frac = match[3] ?? '0'
      const ms = frac.length === 3 ? Number(frac) : Number(frac) * 10
      stamps.push(min * 60_000 + sec * 1000 + ms)
    }

    if (!stamps.length) continue
    const text = raw.replace(stamp, '').trim()
    // Instrumental cues carry a timestamp but no words — skip them.
    if (!text) continue
    for (const t of stamps) out.push({ t, text })
  }

  return out.sort((a, b) => a.t - b.t)
}

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

/** `m:ss` — the timestamp the app can optionally show beside each line. */
export function formatLrcStamp(ms: number): string {
  const total = Math.max(0, ms)
  const m = Math.floor(total / 60_000)
  const s = Math.floor((total % 60_000) / 1000)
  return `${m}:${String(s).padStart(2, '0')}`
}
