import type { LyricLine } from './lyrics'
import { getCurrentLineIndex } from './lyrics'

export interface LyricBoundary {
  /** Index of the line that becomes active at the boundary. */
  index: number
  /** How long from positionMs until that boundary. */
  delayMs: number
}

/**
 * The next moment the active lyric line changes, or null when there is
 * nothing left to schedule (no lines, or already past the last line).
 * Drives the event-driven renderer: one timer per boundary instead of
 * a continuous animation loop.
 */
export function nextBoundary(lines: LyricLine[], positionMs: number): LyricBoundary | null {
  if (lines.length === 0) return null
  const nextIndex = getCurrentLineIndex(lines, positionMs) + 1
  if (nextIndex >= lines.length) return null
  const line = lines[nextIndex]
  return { index: nextIndex, delayMs: Math.max(0, line.timeMs - positionMs) }
}
