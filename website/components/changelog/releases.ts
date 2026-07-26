/**
 * The release log.
 *
 * Written in the first person, because that is the point of the page: a
 * changelog that sounds like someone shipped it rather than a table of tags.
 *
 * KEEP IT SHORT. The screen already carries a headline, a plate, a song and a
 * version the size of a poster — the writing has to leave room for all of it.
 * The shape that works:
 *   lede  — one sentence, what changed for the reader
 *   note  — one line, in your own voice, why it mattered
 *   points — letters only, three at the very most, a label and a sentence each
 * Anything longer than that belongs in the release notes on GitHub, which is
 * one click away from every dispatch.
 *
 * Corrections carry NO points at all. They are one line in an interlude that
 * opens to two short sentences — anyone who wants the post-mortem follows the
 * link. Writing them up in full here is what made the page feel oversaturated,
 * and it spends the reader's attention on the releases that mattered least.
 * Their `lede` is plain language on purpose: no stack traces, no API names.
 *
 * `kind` drives emphasis, and nothing else does:
 *   'launch'  — the thing existing at all          -> a letter
 *   'feature' — a capability that was not there     -> a letter
 *   'fix'     — a correction                        -> one line in the interlude
 *
 * `track` is optional. A release only carries one where there was actually a
 * song attached to the memory; the page has to read correctly without it.
 *
 * Newest first. Everything on the page is derived from this file.
 */

export type ReleaseKind = 'launch' | 'feature' | 'fix'

export interface Track {
  /** Hashed to pick the jewel, the plate style and the modal numbers. */
  key: string
  title: string
  artist: string
}

export interface Point {
  h: string
  d: string
}

export interface Release {
  version: string
  tag: string
  date: string
  dateLong: string
  title: string
  kind: ReleaseKind
  /** Fallback accent for a release with no song. */
  accent: string
  headline?: string
  lede: string
  note?: string
  /** Letters only. A correction is a line and a link, not a breakdown. */
  points?: Point[]
  url: string
  track?: Track
}

const REPO = 'https://github.com/Meet2304/Project-Linea/releases/tag/'

export const RELEASES: Release[] = [
  {
    version: '0.1.4',
    tag: 'v0.1.4',
    date: '2026-07-25',
    dateLong: '25 July 2026',
    title: 'Lyrics fallback',
    kind: 'feature',
    accent: 'var(--amethyst)',
    track: {
      key: 'Fire on Fire — Sam Smith',
      title: 'Fire on Fire',
      artist: 'Sam Smith'
    },

    headline: 'One source was never enough.',
    lede: 'Lyrics no longer depend on a single host.',
    note: '0.1.3 taught the app to admit it could not reach the words. This one means it rarely has to.',

    points: [
      {
        h: 'A second source',
        d: 'NetEase steps in when LRCLIB is unreachable, held to a stricter bar — the wrong words are worse than none.'
      },
      {
        h: 'Better matching',
        d: 'A fuzzy search recovers tracks the exact lookup was walking straight past.'
      },
      {
        h: 'Fails faster',
        d: 'A source that keeps failing steps aside for a few minutes instead of being waited on.'
      }
    ],
    url: REPO + 'v0.1.4'
  },

  {
    version: '0.1.3',
    tag: 'v0.1.3',
    date: '2026-07-25',
    dateLong: '25 July 2026',
    title: 'Honest lyrics errors',
    kind: 'fix',
    accent: 'var(--steel)',

    lede: 'When lyrics could not be fetched, Linea blamed the song. Now it admits it could not reach the service.',
    note: 'Half of this one was not my bug. The reporting was.',
    url: REPO + 'v0.1.3'
  },

  {
    version: '0.1.2',
    tag: 'v0.1.2',
    date: '2026-07-25',
    dateLong: '25 July 2026',
    title: 'Spotify login fix',
    kind: 'fix',
    accent: 'var(--steel)',

    lede: 'The released builds were missing the key they needed to talk to Spotify, so signing in never worked.',
    note: 'Connect Spotify could only ever produce its own error message. In every build shipped so far.',
    url: REPO + 'v0.1.2'
  },

  {
    version: '0.1.1',
    tag: 'v0.1.1',
    date: '2026-07-25',
    dateLong: '25 July 2026',
    title: 'Launch fix',
    kind: 'fix',
    accent: 'var(--steel)',

    lede: 'A missing file stopped the app before it finished starting, so it opened to an empty panel.',
    note: 'It never reproduced in development. Only the packaged build — the only one anybody downloads — was broken.',
    url: REPO + 'v0.1.1'
  },

  {
    version: '0.1.0',
    tag: 'v0.1.0',
    date: '2026-07-25',
    dateLong: '25 July 2026',
    title: 'First light',
    kind: 'launch',
    accent: 'var(--sapphire)',
    track: {
      key: 'Indigo — Henry Moodie',
      title: 'Indigo',
      artist: 'Henry Moodie'
    },

    headline: 'Linea exists.',
    lede: 'Synced lyrics, floating above everything else you are doing.',
    note: 'It did not survive contact with a packaged build. But this is where the line starts.',
    points: [
      { h: 'Lyrics, live', d: 'The current line, in place, on the clock.' },
      { h: 'Always on top', d: 'A frameless panel you can put anywhere and forget about.' },
      { h: 'Windows and macOS', d: 'Signed installers for both, from the same source.' }
    ],
    url: REPO + 'v0.1.0'
  }
]
