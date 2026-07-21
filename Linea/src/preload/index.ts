import { contextBridge, ipcRenderer } from 'electron'
import { IPC } from '../shared/ipcChannels'
import type { NowPlaying, Prefs } from '../shared/types'
import type { LyricLine } from '../shared/lyrics'

contextBridge.exposeInMainWorld('linea', {
  toggleClickThrough: (): Promise<boolean> => ipcRenderer.invoke(IPC.TOGGLE_CLICK_THROUGH),
  getClickThroughState: (): Promise<boolean> => ipcRenderer.invoke(IPC.GET_CLICK_THROUGH_STATE),
  login: (): Promise<boolean> => ipcRenderer.invoke(IPC.SPOTIFY_LOGIN),
  logout: (): Promise<void> => ipcRenderer.invoke(IPC.SPOTIFY_LOGOUT),
  getAuthState: (): Promise<boolean> => ipcRenderer.invoke(IPC.SPOTIFY_AUTH_STATE),
  onNowPlaying: (callback: (data: NowPlaying | null) => void): (() => void) => {
    const listener = (_event: unknown, data: NowPlaying | null): void => callback(data)
    ipcRenderer.on(IPC.NOW_PLAYING, listener)
    return () => ipcRenderer.removeListener(IPC.NOW_PLAYING, listener)
  },
  onLyricsUpdate: (callback: (lines: LyricLine[]) => void): (() => void) => {
    const listener = (_event: unknown, lines: LyricLine[]): void => callback(lines)
    ipcRenderer.on(IPC.LYRICS_UPDATE, listener)
    return () => ipcRenderer.removeListener(IPC.LYRICS_UPDATE, listener)
  },
  getPrefs: (): Promise<Prefs> => ipcRenderer.invoke(IPC.GET_PREFS),
  setPrefs: (partial: Partial<Prefs>): Promise<Prefs> => ipcRenderer.invoke(IPC.SET_PREFS, partial)
})
