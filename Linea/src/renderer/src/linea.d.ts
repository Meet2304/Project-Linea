import type {
  ApiResult,
  PlayerCommandRequest,
  PlayerErrorEvent,
  PlaybackSnapshot,
  Prefs,
  UpdateState
} from '../../shared/types'
import type { Diagnostics } from '../../shared/feedbackUrl'

interface LineaAPI {
  toggleClickThrough: () => Promise<boolean>
  getClickThroughState: () => Promise<boolean>
  setPointerOverPanel: (over: boolean) => Promise<void>
  getPlaybackSnapshot: () => Promise<PlaybackSnapshot>
  playerCommand: (command: PlayerCommandRequest) => Promise<ApiResult<null>>
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
  onNowPlaying: (callback: (data: PlaybackSnapshot) => void) => () => void
  onLyricsUpdate: (callback: (result: PlaybackSnapshot) => void) => () => void
  onClickThroughChanged: (callback: (on: boolean) => void) => () => void
  onWindowFocusChanged: (callback: (focused: boolean) => void) => () => void
  onPlayerError: (callback: (event: PlayerErrorEvent) => void) => () => void
  getPrefs: () => Promise<Prefs>
  setPrefs: (partial: Partial<Prefs>) => Promise<Prefs>
  getUpdateState: () => Promise<UpdateState>
  checkForUpdate: () => Promise<void>
  installUpdate: () => Promise<void>
  getDiagnostics: () => Promise<Diagnostics>
  onUpdateState: (callback: (state: UpdateState) => void) => () => void
}

declare global {
  interface Window {
    linea: LineaAPI
  }
}

export {}
