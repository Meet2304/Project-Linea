import type { ApiResult, PlayerState, RepeatMode } from '../shared/types'
import { spotifyFetch } from './spotifyClient'

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

interface SpotifyPlaybackState {
  is_playing?: boolean
  progress_ms?: number
  item?: SpotifyTrack | null
  shuffle_state?: boolean
  repeat_state?: string
  device?: { is_active?: boolean }
}

export function hasTrackChanged(previous: PlayerState | null, next: PlayerState): boolean {
  return previous?.trackId !== next.trackId
}

function toRepeatMode(value: string | undefined): RepeatMode {
  return value === 'track' || value === 'context' ? value : 'off'
}

function toPlayerState(data: SpotifyPlaybackState, deviceActive: boolean): PlayerState {
  return {
    isPlaying: data.is_playing ?? false,
    trackId: data.item?.id ?? null,
    trackName: data.item?.name ?? '',
    artistName: data.item?.artists?.[0]?.name ?? '',
    albumName: data.item?.album?.name ?? '',
    durationMs: data.item?.duration_ms ?? 0,
    progressMs: data.progress_ms ?? 0,
    fetchedAt: Date.now(),
    shuffle: data.shuffle_state ?? false,
    repeat: toRepeatMode(data.repeat_state),
    liked: null,
    deviceActive
  }
}

/** Full playback state (needs user-read-playback-state). 204 → null. */
export async function fetchPlaybackState(): Promise<ApiResult<PlayerState | null>> {
  const result = await spotifyFetch('/v1/me/player')
  if (!result.ok) return result
  if (result.data.status === 204 || result.data.body === null) return { ok: true, data: null }
  const data = result.data.body as SpotifyPlaybackState
  return { ok: true, data: toPlayerState(data, data.device?.is_active ?? true) }
}

/**
 * Read-only fallback for refresh tokens issued before the transport
 * scopes were added (only needs user-read-currently-playing).
 */
export async function fetchCurrentlyPlayingLegacy(): Promise<ApiResult<PlayerState | null>> {
  const result = await spotifyFetch('/v1/me/player/currently-playing')
  if (!result.ok) return result
  if (result.data.status === 204 || result.data.body === null) return { ok: true, data: null }
  return { ok: true, data: toPlayerState(result.data.body as SpotifyPlaybackState, true) }
}

async function command(method: 'PUT' | 'POST', path: string): Promise<ApiResult<null>> {
  const result = await spotifyFetch(path, { method })
  if (!result.ok) return result
  return { ok: true, data: null }
}

export const play = (): Promise<ApiResult<null>> => command('PUT', '/v1/me/player/play')
export const pause = (): Promise<ApiResult<null>> => command('PUT', '/v1/me/player/pause')
export const next = (): Promise<ApiResult<null>> => command('POST', '/v1/me/player/next')
export const previous = (): Promise<ApiResult<null>> => command('POST', '/v1/me/player/previous')

export const seek = (positionMs: number): Promise<ApiResult<null>> =>
  command('PUT', `/v1/me/player/seek?position_ms=${Math.max(0, Math.round(positionMs))}`)

export const setShuffle = (state: boolean): Promise<ApiResult<null>> =>
  command('PUT', `/v1/me/player/shuffle?state=${state}`)

export const setRepeat = (mode: RepeatMode): Promise<ApiResult<null>> =>
  command('PUT', `/v1/me/player/repeat?state=${mode}`)

export async function checkSaved(trackId: string): Promise<ApiResult<boolean>> {
  const result = await spotifyFetch(`/v1/me/tracks/contains?ids=${encodeURIComponent(trackId)}`)
  if (!result.ok) return result
  const body = result.data.body
  return { ok: true, data: Array.isArray(body) ? body[0] === true : false }
}

export const saveTrack = (trackId: string): Promise<ApiResult<null>> =>
  command('PUT', `/v1/me/tracks?ids=${encodeURIComponent(trackId)}`)

export async function removeTrack(trackId: string): Promise<ApiResult<null>> {
  const result = await spotifyFetch(`/v1/me/tracks?ids=${encodeURIComponent(trackId)}`, {
    method: 'DELETE'
  })
  if (!result.ok) return result
  return { ok: true, data: null }
}
