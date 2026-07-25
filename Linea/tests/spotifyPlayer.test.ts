import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('../src/main/spotifyClient', () => ({
  spotifyFetch: vi.fn()
}))

import {
  fetchPlaybackState,
  fetchCurrentlyPlayingLegacy,
  hasTrackChanged,
  play,
  pause,
  next,
  previous,
  seek,
  setShuffle,
  setRepeat,
  checkSaved,
  saveTrack,
  removeTrack
} from '../src/main/spotifyPlayer'
import { spotifyFetch } from '../src/main/spotifyClient'
import type { PlayerState } from '../src/shared/types'

const makeState = (overrides: Partial<PlayerState> = {}): PlayerState => ({
  isPlaying: true,
  trackId: 'track-1',
  trackName: 'Test Track',
  artistName: 'Test Artist',
  albumName: 'Test Album',
  durationMs: 200000,
  progressMs: 30000,
  fetchedAt: Date.now(),
  shuffle: false,
  repeat: 'off',
  liked: null,
  deviceActive: true,
  ...overrides
})

const okBody = (
  status: number,
  body: unknown
): { ok: true; data: { status: number; body: unknown } } => ({
  ok: true as const,
  data: { status, body }
})

beforeEach(() => {
  vi.mocked(spotifyFetch).mockReset()
})

describe('hasTrackChanged', () => {
  it('returns true when track id differs', () => {
    expect(hasTrackChanged(makeState({ trackId: 'a' }), makeState({ trackId: 'b' }))).toBe(true)
  })
  it('returns false when track id is the same', () => {
    expect(hasTrackChanged(makeState({ trackId: 'a' }), makeState({ trackId: 'a' }))).toBe(false)
  })
  it('returns true when previous is null', () => {
    expect(hasTrackChanged(null, makeState())).toBe(true)
  })
})

describe('fetchPlaybackState', () => {
  it('maps the full playback payload', async () => {
    vi.mocked(spotifyFetch).mockResolvedValueOnce(
      okBody(200, {
        is_playing: true,
        progress_ms: 12000,
        shuffle_state: true,
        repeat_state: 'context',
        device: { is_active: true },
        item: {
          id: 'abc123',
          name: 'My Song',
          duration_ms: 180000,
          artists: [{ name: 'The Artist' }],
          album: { name: 'The Album' }
        }
      })
    )

    const result = await fetchPlaybackState()
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.data).toMatchObject({
      trackId: 'abc123',
      trackName: 'My Song',
      shuffle: true,
      repeat: 'context',
      deviceActive: true,
      liked: null
    })
    expect(spotifyFetch).toHaveBeenCalledWith('/v1/me/player')
  })

  it('returns null data for 204 (nothing playing)', async () => {
    vi.mocked(spotifyFetch).mockResolvedValueOnce(okBody(204, null))
    const result = await fetchPlaybackState()
    expect(result).toEqual({ ok: true, data: null })
  })

  it('normalizes unknown repeat states to off', async () => {
    vi.mocked(spotifyFetch).mockResolvedValueOnce(
      okBody(200, { repeat_state: 'weird', item: { id: 'x' } })
    )
    const result = await fetchPlaybackState()
    expect(result.ok && result.data?.repeat).toBe('off')
  })

  it('passes typed errors through', async () => {
    vi.mocked(spotifyFetch).mockResolvedValueOnce({ ok: false, reason: 'insufficient_scope' })
    const result = await fetchPlaybackState()
    expect(result).toEqual({ ok: false, reason: 'insufficient_scope' })
  })
})

describe('fetchCurrentlyPlayingLegacy', () => {
  it('uses the read-only endpoint', async () => {
    vi.mocked(spotifyFetch).mockResolvedValueOnce(okBody(200, { item: { id: 'abc' } }))
    const result = await fetchCurrentlyPlayingLegacy()
    expect(result.ok && result.data?.trackId).toBe('abc')
    expect(spotifyFetch).toHaveBeenCalledWith('/v1/me/player/currently-playing')
  })
})

const playerInit = (method: 'PUT' | 'POST'): RequestInit => ({
  method,
  headers: { 'Content-Type': 'application/json' },
  body: '{}'
})

describe('transport commands', () => {
  beforeEach(() => {
    vi.mocked(spotifyFetch).mockResolvedValue(okBody(204, null))
  })

  it.each([
    ['play', play, 'PUT', '/v1/me/player/play'],
    ['pause', pause, 'PUT', '/v1/me/player/pause'],
    ['next', next, 'POST', '/v1/me/player/next'],
    ['previous', previous, 'POST', '/v1/me/player/previous']
  ] as const)('%s hits %s %s with a JSON body', async (_name, fn, method, path) => {
    const result = await fn()
    expect(result).toEqual({ ok: true, data: null })
    expect(spotifyFetch).toHaveBeenCalledWith(path, playerInit(method))
  })

  it('seek rounds and clamps the position', async () => {
    await seek(1234.6)
    expect(spotifyFetch).toHaveBeenCalledWith(
      '/v1/me/player/seek?position_ms=1235',
      playerInit('PUT')
    )
    await seek(-50)
    expect(spotifyFetch).toHaveBeenCalledWith('/v1/me/player/seek?position_ms=0', playerInit('PUT'))
  })

  it('setShuffle and setRepeat pass their state', async () => {
    await setShuffle(true)
    expect(spotifyFetch).toHaveBeenCalledWith('/v1/me/player/shuffle?state=true', playerInit('PUT'))
    await setRepeat('track')
    expect(spotifyFetch).toHaveBeenCalledWith('/v1/me/player/repeat?state=track', playerInit('PUT'))
  })

  it('retries play on an available device after a false Premium/no-device failure', async () => {
    vi.mocked(spotifyFetch)
      .mockResolvedValueOnce({ ok: false, reason: 'premium_required' })
      .mockResolvedValueOnce(
        okBody(200, {
          devices: [{ id: 'device-1', is_active: true, is_restricted: false }]
        })
      )
      .mockResolvedValueOnce(okBody(204, null))

    const result = await play()
    expect(result).toEqual({ ok: true, data: null })
    expect(spotifyFetch).toHaveBeenNthCalledWith(1, '/v1/me/player/play', playerInit('PUT'))
    expect(spotifyFetch).toHaveBeenNthCalledWith(2, '/v1/me/player/devices')
    expect(spotifyFetch).toHaveBeenNthCalledWith(
      3,
      '/v1/me/player/play?device_id=device-1',
      playerInit('PUT')
    )
  })

  it('maps Premium-required with no devices to no_device', async () => {
    vi.mocked(spotifyFetch)
      .mockResolvedValueOnce({ ok: false, reason: 'premium_required' })
      .mockResolvedValueOnce(okBody(200, { devices: [] }))

    const result = await play()
    expect(result).toEqual({ ok: false, reason: 'no_device' })
  })

  it('maps repeated Premium-required to no_device when the account is Premium', async () => {
    vi.mocked(spotifyFetch)
      .mockResolvedValueOnce({ ok: false, reason: 'premium_required' })
      .mockResolvedValueOnce(
        okBody(200, {
          devices: [{ id: 'device-1', is_active: true, is_restricted: false }]
        })
      )
      .mockResolvedValueOnce({ ok: false, reason: 'premium_required' })
      .mockResolvedValueOnce(okBody(200, { product: 'premium' }))

    const result = await play()
    expect(result).toEqual({ ok: false, reason: 'no_device' })
  })
})

describe('library', () => {
  it('checkSaved parses the contains array', async () => {
    vi.mocked(spotifyFetch).mockResolvedValueOnce(okBody(200, [true]))
    const result = await checkSaved('abc')
    expect(result).toEqual({ ok: true, data: true })
    expect(spotifyFetch).toHaveBeenCalledWith('/v1/me/tracks/contains?ids=abc')
  })

  it('saveTrack and removeTrack hit the tracks endpoint', async () => {
    vi.mocked(spotifyFetch).mockResolvedValue(okBody(200, null))
    await saveTrack('abc')
    expect(spotifyFetch).toHaveBeenCalledWith('/v1/me/tracks?ids=abc', { method: 'PUT' })
    await removeTrack('abc')
    expect(spotifyFetch).toHaveBeenCalledWith('/v1/me/tracks?ids=abc', { method: 'DELETE' })
  })
})
