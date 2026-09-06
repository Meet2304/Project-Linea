export interface PollContext {
  isPlaying: boolean
  msToTrackEnd: number | null
}
export const PLAYING_POLL_MS = 2000
export const IDLE_POLL_MS = 10000
export const MIN_POLL_MS = 250
/** Events trigger immediate reads; this interval reconciles missed events. */
export function nextPollDelay(ctx: PollContext): number {
  if (!ctx.isPlaying) return IDLE_POLL_MS
  if (ctx.msToTrackEnd !== null && ctx.msToTrackEnd >= 0)
    return Math.max(MIN_POLL_MS, Math.min(PLAYING_POLL_MS, ctx.msToTrackEnd + 250))
  return PLAYING_POLL_MS
}
