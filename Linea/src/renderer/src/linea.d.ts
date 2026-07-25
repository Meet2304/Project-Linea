import type {
  ApiResult,
  PlayerCommand,
  PlayerErrorEvent,
  PlayerState,
  Prefs
} from '../../shared/types'
import type { LyricsResult } from '../../shared/lyrics'

interface LineaAPI {
  toggleClickThrough: () => Promise<boolean>
  getClickThroughState: () => Promise<boolean>
  setPointerOverPanel: (over: boolean) => Promise<void>
  login: () => Promise<boolean>
  logout: () => Promise<void>
  getAuthState: () => Promise<boolean>
  playerCommand: (command: PlayerCommand) => Promise<ApiResult<null>>
  toggleLike: () => Promise<ApiResult<boolean>>
  setPinned: (pinned: boolean) => Promise<void>
  resizeTo: (height: number) => Promise<void>
  getWindowBounds: () => Promise<{ x: number; y: number; width: number; height: number }>
  setWindowBounds: (bounds: {
    x: number
    y: number
    width: number
    height: number
  }) => Promise<void>
  closeWindow: () => Promise<void>
  onNowPlaying: (callback: (data: PlayerState | null) => void) => () => void
  onLyricsUpdate: (callback: (result: LyricsResult) => void) => () => void
  onClickThroughChanged: (callback: (on: boolean) => void) => () => void
  onWindowFocusChanged: (callback: (focused: boolean) => void) => () => void
  onPlayerError: (callback: (event: PlayerErrorEvent) => void) => () => void
  getPrefs: () => Promise<Prefs>
  setPrefs: (partial: Partial<Prefs>) => Promise<Prefs>
}

declare global {
  interface Window {
    linea: LineaAPI
  }
}

export {}
