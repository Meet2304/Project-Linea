export interface PollContext {
  /** A refresh or access token exists. */
  authed: boolean
  isPlaying: boolean
  /** Time until the current track ends, when known. */
  msToTrackEnd: number | null
}

export const PLAYING_POLL_MS = 2000
export const IDLE_POLL_MS = 10000
export const MIN_POLL_MS = 250

/**
 * Delay until the next now-playing poll, or null to stop polling
 * entirely (no auth — polling resumes on login). Near the end of a
 * track the delay shrinks so the track change is caught promptly.
 */
export function nextPollDelay(ctx: PollContext): number | null {
  if (!ctx.authed) return null
  if (!ctx.isPlaying) return IDLE_POLL_MS
  if (ctx.msToTrackEnd !== null && ctx.msToTrackEnd >= 0) {
    return Math.max(MIN_POLL_MS, Math.min(PLAYING_POLL_MS, ctx.msToTrackEnd + 250))
  }
  return PLAYING_POLL_MS
}
