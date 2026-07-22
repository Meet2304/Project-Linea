export type RepeatMode = 'off' | 'context' | 'track'

export interface PlayerState {
  isPlaying: boolean
  trackId: string | null
  trackName: string
  artistName: string
  albumName: string
  durationMs: number
  progressMs: number
  fetchedAt: number
  shuffle: boolean
  repeat: RepeatMode
  liked: boolean | null
  deviceActive: boolean
}

/** Legacy alias — the pre-transport shape was a subset of PlayerState. */
export type NowPlaying = PlayerState

export type PlayerCommand =
  | { type: 'play' }
  | { type: 'pause' }
  | { type: 'next' }
  | { type: 'previous' }
  | { type: 'seek'; positionMs: number }
  | { type: 'shuffle'; state: boolean }
  | { type: 'repeat'; mode: RepeatMode }

export type PlayerErrorReason =
  | 'premium_required'
  | 'no_device'
  | 'rate_limited'
  | 'auth_expired'
  | 'insufficient_scope'
  | 'network'

export type ApiResult<T> =
  | { ok: true; data: T }
  | { ok: false; reason: PlayerErrorReason; retryAfterMs?: number }

export interface PlayerErrorEvent {
  reason: PlayerErrorReason
  message: string
}

export type Theme = 'light' | 'dark'

export interface Prefs {
  opacity: number
  fontSize: number
  theme: Theme
  pinned: boolean
  lyricsExpanded: boolean
}
