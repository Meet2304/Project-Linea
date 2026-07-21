export interface NowPlaying {
  isPlaying: boolean
  trackId: string | null
  trackName: string
  artistName: string
  albumName: string
  durationMs: number
  progressMs: number
  fetchedAt: number
}

export interface Prefs {
  opacity: number
  fontSize: number
}
