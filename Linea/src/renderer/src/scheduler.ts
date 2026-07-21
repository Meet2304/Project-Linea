import type { LyricLine } from '../../shared/lyrics'
import type { PlayerState } from '../../shared/types'
import { estimatePositionMs, getCurrentLineIndex } from '../../shared/lyrics'
import { nextBoundary } from '../../shared/lyricSchedule'

/**
 * Event-driven lyric engine: instead of recomputing the active line
 * every animation frame, arm exactly one timer for the next LRC
 * boundary. Paused or idle means zero timers.
 */
export class LyricScheduler {
  private timer: ReturnType<typeof setTimeout> | null = null

  constructor(private readonly onLine: (index: number) => void) {}

  /** Re-sync after any state change (poll push, seek, play/pause, new lyrics). */
  sync(lines: LyricLine[], player: PlayerState | null): void {
    this.stop()
    if (!player || lines.length === 0) return
    this.onLine(getCurrentLineIndex(lines, estimatePositionMs(player)))
    if (player.isPlaying) this.arm(lines, player)
  }

  stop(): void {
    if (this.timer !== null) {
      clearTimeout(this.timer)
      this.timer = null
    }
  }

  private arm(lines: LyricLine[], player: PlayerState): void {
    const boundary = nextBoundary(lines, estimatePositionMs(player))
    if (!boundary) return
    // +15ms so the timer fires just past the boundary, never before it.
    this.timer = setTimeout(() => {
      this.onLine(boundary.index)
      this.arm(lines, player)
    }, boundary.delayMs + 15)
  }
}
