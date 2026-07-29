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

/** Lyrics size preset — drives both font size and how many lines show. */
export type LyricsSize = 'small' | 'medium' | 'large'

/** Last placed window rect — restored across launches after the first move. */
export interface WindowBounds {
  x: number
  y: number
  width: number
  height: number
}

/**
 * Everything the update UI needs, as one union so the renderer never has to
 * infer state from a combination of flags. `version` is always the running
 * app version, so the settings row can name it in every state; `next` is the
 * version being offered.
 *
 * `manual` is macOS: the build is unsigned and dmg-only, so electron-updater
 * cannot install it — we can only point the user at the release page.
 */
export type UpdateState =
  | { status: 'idle'; version: string }
  | { status: 'checking'; version: string }
  | { status: 'downloading'; version: string; next: string; percent: number }
  | { status: 'ready'; version: string; next: string }
  | { status: 'manual'; version: string; next: string }
  | { status: 'error'; version: string }

export interface Prefs {
  opacity: number
  lyricsSize: LyricsSize
  theme: Theme
  pinned: boolean
  lyricsExpanded: boolean
  /** When true, each lyric line shows its start timestamp. */
  showTimestamps: boolean
  /** Null until the user has moved or resized the window at least once. */
  windowBounds: WindowBounds | null
}
