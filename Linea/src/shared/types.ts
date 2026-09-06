import type { LyricsResult } from './lyrics'

export type RepeatMode = 'off' | 'context' | 'track'
export type PlayerCommand =
  | { type: 'play' }
  | { type: 'pause' }
  | { type: 'next' }
  | { type: 'previous' }
  | { type: 'seek'; positionMs: number }
  | { type: 'shuffle'; state: boolean }
  | { type: 'repeat'; mode: RepeatMode }
export type PlayerCapabilities = Record<PlayerCommand['type'], boolean>

export interface PlayerState {
  sessionId: string
  mediaRevision: number
  isPlaying: boolean
  trackId: string | null
  trackName: string
  artistName: string
  albumName: string
  durationMs: number
  progressMs: number
  fetchedAt: number
  playbackRate: number
  timelineValid: boolean
  seekMinMs: number
  seekMaxMs: number
  capabilities: PlayerCapabilities
  shuffle: boolean | null
  repeat: RepeatMode | null
}
export type NowPlaying = PlayerState
export interface PlayerCommandRequest {
  sessionId: string
  trackId: string | null
  mediaRevision: number
  command: PlayerCommand
}
export type PlayerErrorReason =
  | 'source_unavailable'
  | 'session_unavailable'
  | 'unsupported_command'
  | 'command_rejected'
  | 'timeout'
  | 'invalid_request'
export type ApiResult<T> = { ok: true; data: T } | { ok: false; reason: PlayerErrorReason }
export interface PlayerErrorEvent {
  reason: PlayerErrorReason
  message: string
}
export type SourceStatus = 'ready' | 'idle' | 'unavailable' | 'unsupported'
export interface PlaybackSnapshot {
  revision: number
  player: PlayerState | null
  lyrics: LyricsResult
  sourceStatus: SourceStatus
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
