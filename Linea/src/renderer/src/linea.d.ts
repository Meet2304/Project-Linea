import type { NowPlaying, Prefs } from '../../shared/types'
import type { LyricLine } from '../../shared/lyrics'

interface LineaAPI {
  toggleClickThrough: () => Promise<boolean>
  getClickThroughState: () => Promise<boolean>
  login: () => Promise<boolean>
  logout: () => Promise<void>
  getAuthState: () => Promise<boolean>
  onNowPlaying: (callback: (data: NowPlaying | null) => void) => () => void
  onLyricsUpdate: (callback: (lines: LyricLine[]) => void) => () => void
  getPrefs: () => Promise<Prefs>
  setPrefs: (partial: Partial<Prefs>) => Promise<Prefs>
}

declare global {
  interface Window {
    linea: LineaAPI
  }
}

export {}
