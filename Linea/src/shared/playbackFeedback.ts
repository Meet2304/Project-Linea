import type { PlayerCommand, PlayerState } from './types'
import { estimatePositionMs } from './lyrics'

export interface PlaybackFeedback {
  command: PlayerCommand
  player: PlayerState
  expiresAt: number
}
export function optimisticPlayer(
  player: PlayerState,
  command: PlayerCommand,
  now = Date.now()
): PlayerState {
  const anchored = { ...player, progressMs: estimatePositionMs(player, now), fetchedAt: now }
  switch (command.type) {
    case 'play':
      return { ...anchored, isPlaying: true }
    case 'pause':
      return { ...anchored, isPlaying: false }
    case 'seek':
      return { ...anchored, progressMs: command.positionMs }
    case 'shuffle':
      return { ...player, shuffle: command.state }
    case 'repeat':
      return { ...player, repeat: command.mode }
    default:
      return player
  }
}
export function keepFeedback(
  feedback: PlaybackFeedback,
  actual: PlayerState | null,
  now = Date.now()
): boolean {
  const p = feedback.player
  if (
    !actual ||
    now >= feedback.expiresAt ||
    p.sessionId !== actual.sessionId ||
    p.trackId !== actual.trackId ||
    p.mediaRevision !== actual.mediaRevision
  )
    return false
  switch (feedback.command.type) {
    case 'play':
    case 'pause':
      return actual.isPlaying !== p.isPlaying
    case 'seek':
      return Math.abs(estimatePositionMs(actual, now) - estimatePositionMs(p, now)) > 1000
    case 'shuffle':
      return actual.shuffle !== p.shuffle
    case 'repeat':
      return actual.repeat !== p.repeat
    default:
      return false
  }
}
export function mergeFeedback(actual: PlayerState, feedback: PlaybackFeedback): PlayerState {
  switch (feedback.command.type) {
    case 'play':
    case 'pause':
      return {
        ...actual,
        isPlaying: feedback.player.isPlaying,
        progressMs: feedback.player.progressMs,
        fetchedAt: feedback.player.fetchedAt
      }
    case 'seek':
      return {
        ...actual,
        progressMs: feedback.player.progressMs,
        fetchedAt: feedback.player.fetchedAt
      }
    case 'shuffle':
      return { ...actual, shuffle: feedback.player.shuffle }
    case 'repeat':
      return { ...actual, repeat: feedback.player.repeat }
    default:
      return actual
  }
}
