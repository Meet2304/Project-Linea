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
  device?: { is_active?: boolean; id?: string | null }
}

interface SpotifyDevice {
  id?: string | null
  is_active?: boolean
  is_restricted?: boolean
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

/** Player PUTs/POSTs need a JSON body — bare method-only fetches often 403. */
function playerRequestInit(method: 'PUT' | 'POST'): RequestInit {
  return {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: '{}'
  }
}

function withDeviceId(path: string, deviceId: string): string {
  const separator = path.includes('?') ? '&' : '?'
  return `${path}${separator}device_id=${encodeURIComponent(deviceId)}`
}

/**
 * Pick a Connect device Spotify will accept commands on. If nothing is
 * active, transfer to the first unrestricted device so resume/pause work.
 */
async function resolveControllableDeviceId(): Promise<string | null> {
  const result = await spotifyFetch('/v1/me/player/devices')
  if (!result.ok) return null
  const body = result.data.body as { devices?: SpotifyDevice[] } | null
  const devices = (body?.devices ?? []).filter(
    (device): device is SpotifyDevice & { id: string } =>
      typeof device.id === 'string' && device.id.length > 0
  )
  if (devices.length === 0) return null

  const active = devices.find((device) => device.is_active && !device.is_restricted)
  if (active) return active.id

  const target = devices.find((device) => !device.is_restricted) ?? devices[0]
  if (!target) return null

  // Best-effort wake — even if transfer fails, targeting device_id may still work.
  await spotifyFetch('/v1/me/player', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ device_ids: [target.id], play: false })
  })
  return target.id
}

async function isPremiumAccount(): Promise<boolean> {
  const result = await spotifyFetch('/v1/me')
  if (!result.ok) return false
  const product = (result.data.body as { product?: string } | null)?.product
  // Family / Duo / Student all report as "premium".
  return product === 'premium'
}

/**
 * Run a Player API command. On Premium/no-device failures, try to bind an
 * available Connect device and retry — Spotify often returns PREMIUM_REQUIRED
 * when the real problem is "no active device", which blocked Premium users.
 */
async function playerCommand(method: 'PUT' | 'POST', path: string): Promise<ApiResult<null>> {
  const init = playerRequestInit(method)
  const result = await spotifyFetch(path, init)
  if (result.ok) return { ok: true, data: null }

  if (result.reason !== 'premium_required' && result.reason !== 'no_device') {
    return result
  }

  const deviceId = await resolveControllableDeviceId()
  if (!deviceId) {
    return { ok: false, reason: 'no_device' }
  }

  const retry = await spotifyFetch(withDeviceId(path, deviceId), init)
  if (retry.ok) return { ok: true, data: null }

  // Still "Premium required" but the account is Premium → device/control issue.
  if (retry.reason === 'premium_required' && (await isPremiumAccount())) {
    return { ok: false, reason: 'no_device' }
  }
  return retry
}

export const play = (): Promise<ApiResult<null>> => playerCommand('PUT', '/v1/me/player/play')
export const pause = (): Promise<ApiResult<null>> => playerCommand('PUT', '/v1/me/player/pause')
export const next = (): Promise<ApiResult<null>> => playerCommand('POST', '/v1/me/player/next')
export const previous = (): Promise<ApiResult<null>> =>
  playerCommand('POST', '/v1/me/player/previous')

export const seek = (positionMs: number): Promise<ApiResult<null>> =>
  playerCommand('PUT', `/v1/me/player/seek?position_ms=${Math.max(0, Math.round(positionMs))}`)

export const setShuffle = (state: boolean): Promise<ApiResult<null>> =>
  playerCommand('PUT', `/v1/me/player/shuffle?state=${state}`)

export const setRepeat = (mode: RepeatMode): Promise<ApiResult<null>> =>
  playerCommand('PUT', `/v1/me/player/repeat?state=${mode}`)

export async function checkSaved(trackId: string): Promise<ApiResult<boolean>> {
  const result = await spotifyFetch(`/v1/me/tracks/contains?ids=${encodeURIComponent(trackId)}`)
  if (!result.ok) return result
  const body = result.data.body
  return { ok: true, data: Array.isArray(body) ? body[0] === true : false }
}

export async function saveTrack(trackId: string): Promise<ApiResult<null>> {
  const result = await spotifyFetch(`/v1/me/tracks?ids=${encodeURIComponent(trackId)}`, {
    method: 'PUT'
  })
  if (!result.ok) return result
  return { ok: true, data: null }
}

export async function removeTrack(trackId: string): Promise<ApiResult<null>> {
  const result = await spotifyFetch(`/v1/me/tracks?ids=${encodeURIComponent(trackId)}`, {
    method: 'DELETE'
  })
  if (!result.ok) return result
  return { ok: true, data: null }
}
