export interface LyricLine {
  timeMs: number
  text: string
}

const LRC_LINE = /\[(\d{2}):(\d{2})(?:\.(\d{2,3}))?\](.*)/

export function parseLrc(syncedLyrics: string): LyricLine[] {
  return syncedLyrics
    .split('\n')
    .map((line) => line.match(LRC_LINE))
    .filter((match): match is RegExpMatchArray => match !== null)
    .map((match) => {
      const minutes = match[1] ?? '0'
      const seconds = match[2] ?? '0'
      const fraction = match[3] ?? '0'
      const text = match[4] ?? ''
      const ms =
        Number(minutes) * 60_000 +
        Number(seconds) * 1000 +
        Number(fraction.padEnd(3, '0').slice(0, 3))
      return { timeMs: ms, text: text.trim() }
    })
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
