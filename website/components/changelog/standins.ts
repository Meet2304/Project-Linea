import type { LyricLine } from '@/components/demo/lyrics'

/**
 * Stand-in lines for the dispatch panels.
 *
 * These are original writing, not the songs. They exist for the same reason
 * FALLBACK exists in components/demo/lyrics.ts: real lyrics are fetched from
 * lrclib at request time through /api/lyrics and never stored in this repo,
 * so the panel needs something to run while that request is in flight, and
 * something to keep running if lrclib has no synced match or cannot be
 * reached at all.
 *
 * A panel showing these says so in a footnote, and drops it the moment the
 * real words arrive.
 */

function cue(texts: string[], startMs: number, gapMs: number): LyricLine[] {
  return texts.map((text, i) => ({ t: startMs + i * gapMs, text }))
}

export interface StandIn {
  lines: LyricLine[]
  durationMs: number
}

export const STANDINS: Record<string, StandIn> = {
  'Badlands — Mumford & Sons, Gracie Abrams': {
    durationMs: 176_000,
    lines: cue(
      [
        'Waiting on the words',
        'though 0.1.5 is the release about everything that was not needed',
        'Linea itself compiles to 616 kilobytes',
        'The install was three hundred and thirty one megabytes',
        'Chromium had shipped fifty five sets of its own menu translations',
        'for menus this overlay does not have',
        'and a shader compiler for graphics it never draws',
        'The tray icon was a 1254 pixel image',
        'being painted at thirty two',
        'None of it had ever run',
        'All of it was being downloaded',
        'Seventy two megabytes lighter now',
        'and nothing about the panel changed'
      ],
      900,
      4300
    )
  },

  'Indigo — Henry Moodie': {
    durationMs: 168_000,
    lines: cue(
      [
        'Waiting on the words',
        'Linea asks lrclib for them at request time',
        'exactly the way the desktop app does',
        'so nothing copyrighted lives in this repo',
        'Everything else here is the panel itself',
        'The line being sung holds the track’s own colour',
        'lines already gone fade back',
        'and the ones coming stay quiet',
        'Scroll away and a Now chip appears',
        'Click any line to jump to it',
        'This is what shipped on the first night',
        'at 2:37 in the morning',
        'with almost nothing else working yet'
      ],
      1200,
      4300
    )
  },

  'Fire on Fire — Sam Smith': {
    durationMs: 172_000,
    lines: cue(
      [
        'Waiting on the words',
        'though 0.1.4 is the release about not needing one source',
        'When a lyrics host cannot be reached',
        'Linea now asks a second one',
        'LRCLIB first, matched loosely enough to find things',
        'NetEase second, held to a much stricter bar',
        'because the wrong words against a song',
        'are worse than no words at all',
        'A source that keeps failing steps aside',
        'and stops being waited on at every track change',
        'Shared cues parse properly now',
        'and production credits are not lyrics',
        'This panel is the overlay, not a picture of it'
      ],
      900,
      4300
    )
  }
}

export const EMPTY_STANDIN: StandIn = { lines: cue(['Waiting on the words'], 0, 1000), durationMs: 60_000 }
