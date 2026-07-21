import type { NowPlaying } from '../shared/types'

interface SpotifyArtist {
  name?: string
}

interface SpotifyAlbum {
  name?: string
}

interface SpotifyTrack {
  id?: string
  name?: string
  artists?: SpotifyArtist[]
  album?: SpotifyAlbum
  duration_ms?: number
}

interface SpotifyCurrentlyPlaying {
  is_playing?: boolean
  progress_ms?: number
  item?: SpotifyTrack | null
}

export function hasTrackChanged(previous: NowPlaying | null, next: NowPlaying): boolean {
  return previous?.trackId !== next.trackId
}

export async function fetchCurrentlyPlaying(accessToken: string): Promise<NowPlaying | null> {
  const response = await fetch('https://api.spotify.com/v1/me/player/currently-playing', {
    headers: { Authorization: `Bearer ${accessToken}` }
  })

  if (response.status === 204) return null
  if (!response.ok) throw new Error(`Spotify API error: ${response.status}`)

  const data = (await response.json()) as SpotifyCurrentlyPlaying
  return {
    isPlaying: data.is_playing ?? false,
    trackId: data.item?.id ?? null,
    trackName: data.item?.name ?? '',
    artistName: data.item?.artists?.[0]?.name ?? '',
    albumName: data.item?.album?.name ?? '',
    durationMs: data.item?.duration_ms ?? 0,
    progressMs: data.progress_ms ?? 0,
    fetchedAt: Date.now()
  }
}
