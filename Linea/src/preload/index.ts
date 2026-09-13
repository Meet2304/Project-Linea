import { contextBridge, ipcRenderer } from 'electron'
import { IPC } from '../shared/ipcChannels'
import type {
  ApiResult,
  PlayerCommandRequest,
  PlayerErrorEvent,
  PlaybackSnapshot,
  Prefs,
  UpdateState
} from '../shared/types'
import type { Diagnostics } from '../shared/feedbackUrl'

function subscribe<T>(channel: string): (callback: (data: T) => void) => () => void {
  return (callback) => {
    const listener = (_event: unknown, data: T): void => callback(data)
    ipcRenderer.on(channel, listener)
    return () => ipcRenderer.removeListener(channel, listener)
  }
}

contextBridge.exposeInMainWorld('linea', {
  toggleClickThrough: (): Promise<boolean> => ipcRenderer.invoke(IPC.TOGGLE_CLICK_THROUGH),
  getClickThroughState: (): Promise<boolean> => ipcRenderer.invoke(IPC.GET_CLICK_THROUGH_STATE),
  setPointerOverPanel: (over: boolean): Promise<void> =>
    ipcRenderer.invoke(IPC.SET_POINTER_OVER_PANEL, over),
  getPlaybackSnapshot: (): Promise<PlaybackSnapshot> =>
    ipcRenderer.invoke(IPC.GET_PLAYBACK_SNAPSHOT),
  playerCommand: (command: PlayerCommandRequest): Promise<ApiResult<null>> =>
    ipcRenderer.invoke(IPC.PLAYER_COMMAND, command),
  setPinned: (pinned: boolean): Promise<void> => ipcRenderer.invoke(IPC.SET_PINNED, pinned),
  resizeTo: (height: number): Promise<void> => ipcRenderer.invoke(IPC.RESIZE_WINDOW, height),
  getWindowBounds: (): Promise<{ x: number; y: number; width: number; height: number }> =>
    ipcRenderer.invoke(IPC.GET_WINDOW_BOUNDS),
  setWindowBounds: (bounds: {
    x: number
    y: number
    width: number
    height: number
  }): Promise<void> => ipcRenderer.invoke(IPC.SET_WINDOW_BOUNDS, bounds),
  closeWindow: (): Promise<void> => ipcRenderer.invoke(IPC.CLOSE_WINDOW),
  onNowPlaying: subscribe<PlaybackSnapshot>(IPC.NOW_PLAYING),
  onLyricsUpdate: subscribe<PlaybackSnapshot>(IPC.LYRICS_UPDATE),
  onClickThroughChanged: subscribe<boolean>(IPC.CLICK_THROUGH_CHANGED),
  onWindowFocusChanged: subscribe<boolean>(IPC.WINDOW_FOCUS_CHANGED),
  onPlayerError: subscribe<PlayerErrorEvent>(IPC.PLAYER_ERROR),
  getPrefs: (): Promise<Prefs> => ipcRenderer.invoke(IPC.GET_PREFS),
  setPrefs: (partial: Partial<Prefs>): Promise<Prefs> => ipcRenderer.invoke(IPC.SET_PREFS, partial),
  getUpdateState: (): Promise<UpdateState> => ipcRenderer.invoke(IPC.GET_UPDATE_STATE),
  checkForUpdate: (): Promise<void> => ipcRenderer.invoke(IPC.CHECK_FOR_UPDATE),
  installUpdate: (): Promise<void> => ipcRenderer.invoke(IPC.INSTALL_UPDATE),
  getDiagnostics: (): Promise<Diagnostics> => ipcRenderer.invoke(IPC.GET_DIAGNOSTICS),
  onUpdateState: subscribe<UpdateState>(IPC.UPDATE_STATE)
})
