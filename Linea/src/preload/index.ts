import { contextBridge, ipcRenderer } from 'electron'
import { IPC } from '../shared/ipcChannels'
import type {
  ApiResult,
  PlayerCommand,
  PlayerErrorEvent,
  PlayerState,
  Prefs
} from '../shared/types'
import type { LyricLine } from '../shared/lyrics'

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
  login: (): Promise<boolean> => ipcRenderer.invoke(IPC.SPOTIFY_LOGIN),
  logout: (): Promise<void> => ipcRenderer.invoke(IPC.SPOTIFY_LOGOUT),
  getAuthState: (): Promise<boolean> => ipcRenderer.invoke(IPC.SPOTIFY_AUTH_STATE),
  playerCommand: (command: PlayerCommand): Promise<ApiResult<null>> =>
    ipcRenderer.invoke(IPC.PLAYER_COMMAND, command),
  toggleLike: (): Promise<ApiResult<boolean>> => ipcRenderer.invoke(IPC.TOGGLE_LIKE),
  setPinned: (pinned: boolean): Promise<void> => ipcRenderer.invoke(IPC.SET_PINNED, pinned),
  setLyricsExpanded: (expanded: boolean): Promise<void> =>
    ipcRenderer.invoke(IPC.SET_LYRICS_EXPANDED, expanded),
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
  onNowPlaying: subscribe<PlayerState | null>(IPC.NOW_PLAYING),
  onLyricsUpdate: subscribe<LyricLine[]>(IPC.LYRICS_UPDATE),
  onClickThroughChanged: subscribe<boolean>(IPC.CLICK_THROUGH_CHANGED),
  onPlayerError: subscribe<PlayerErrorEvent>(IPC.PLAYER_ERROR),
  getPrefs: (): Promise<Prefs> => ipcRenderer.invoke(IPC.GET_PREFS),
  setPrefs: (partial: Partial<Prefs>): Promise<Prefs> => ipcRenderer.invoke(IPC.SET_PREFS, partial)
})
