export interface LyricLine {
  timeMs: number
  text: string
}

/**
 * `none` — lrclib answered, this track has no synced lyrics.
 * `unreachable` — we never got an answer, so we know nothing about the track.
 */
export type LyricsStatus = 'ok' | 'none' | 'unreachable'

export interface LyricsResult {
  lines: LyricLine[]
  status: LyricsStatus
}

/**
 * One leading timestamp. Minutes may be one or two digits, and the fractional
 * part may be separated by `.` or `:` — both dialects are in the wild.
 */
const LRC_TIMESTAMP = /\[(\d{1,2}):(\d{2})(?:[.:](\d{1,3}))?\]/g

/**
 * Production credits that some providers emit as real timestamped lines at
 * the head of the file (`[00:00.00] 作词 : Freddie Mercury`). They are not
 * lyrics and must not scroll past as though they were.
 */
const CREDIT_ROW =
  /^(?:作词|作曲|编曲|制作人|出品人|出品|监制|混音|母带|录音|配唱|和声|吉他|贝斯|鼓|键盘|弦乐|策划|统筹|发行|企划|词|曲|OP|SP)\s*[:：]/

/**
 * Parses LRC into timed lines.
 *
 * Handles the two forms LRCLIB never produces but other providers do: several
 * timestamps sharing one line of text (a repeated chorus, which must expand
 * into one entry per timestamp) and single-digit minutes. Getting either
 * wrong silently drops or corrupts lines rather than failing loudly.
 */
export function parseLrc(syncedLyrics: string): LyricLine[] {
  const parsed: LyricLine[] = []

  for (const raw of syncedLyrics.split('\n')) {
    LRC_TIMESTAMP.lastIndex = 0
    const stamps: number[] = []
    let consumed = 0
    let match: RegExpExecArray | null

    // Only timestamps at the head of the line count. A `[00:05.00]` appearing
    // mid-lyric is text, not a cue.
    while ((match = LRC_TIMESTAMP.exec(raw)) !== null) {
      if (match.index !== consumed) break
      consumed = LRC_TIMESTAMP.lastIndex
      const minutes = Number(match[1] ?? '0')
      const seconds = Number(match[2] ?? '0')
      // '5' means 500ms, '05' means 50ms, '123' means 123ms.
      const fraction = Number((match[3] ?? '0').padEnd(3, '0').slice(0, 3))
      stamps.push(minutes * 60_000 + seconds * 1000 + fraction)
    }

    if (stamps.length === 0) continue

    const text = raw.slice(consumed).trim()
    if (CREDIT_ROW.test(text)) continue

    for (const timeMs of stamps) parsed.push({ timeMs, text })
  }

  return parsed
}

export function getCurrentLineIndex(lines: LyricLine[], positionMs: number): number {
  let index = -1
  for (const line of lines) {
    if (line.timeMs <= positionMs) index++
    else break
  }
  return index
}

export function estimatePositionMs(params: {
  progressMs: number
  fetchedAt: number
  isPlaying: boolean
}): number {
  if (!params.isPlaying) return params.progressMs
  return params.progressMs + (Date.now() - params.fetchedAt)
}
