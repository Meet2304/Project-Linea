import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { fetchCurrentlyPlaying, hasTrackChanged } from '../src/main/spotifyPlayer'
import type { NowPlaying } from '../src/shared/types'

const makeNowPlaying = (overrides: Partial<NowPlaying> = {}): NowPlaying => ({
  isPlaying: true,
  trackId: 'track-1',
  trackName: 'Test Track',
  artistName: 'Test Artist',
  albumName: 'Test Album',
  durationMs: 200000,
  progressMs: 30000,
  fetchedAt: Date.now(),
  ...overrides
})

describe('hasTrackChanged', () => {
  it('returns true when track id differs', () => {
    expect(
      hasTrackChanged(makeNowPlaying({ trackId: 'a' }), makeNowPlaying({ trackId: 'b' }))
    ).toBe(true)
  })
  it('returns false when track id is the same', () => {
    expect(
      hasTrackChanged(makeNowPlaying({ trackId: 'a' }), makeNowPlaying({ trackId: 'a' }))
    ).toBe(false)
  })
  it('returns true when previous is null', () => {
    expect(hasTrackChanged(null, makeNowPlaying())).toBe(true)
  })
})

describe('fetchCurrentlyPlaying', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn())
  })
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('returns null for a 204 response', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(new Response(null, { status: 204 }))
    expect(await fetchCurrentlyPlaying('fake-token')).toBeNull()
  })

  it('throws for a non-ok, non-204 response', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(new Response('{}', { status: 401 }))
    await expect(fetchCurrentlyPlaying('fake-token')).rejects.toThrow('401')
  })

  it('returns a NowPlaying object for a valid 200 response', async () => {
    const payload = {
      is_playing: true,
      progress_ms: 12000,
      item: {
        id: 'abc123',
        name: 'My Song',
        duration_ms: 180000,
        artists: [{ name: 'The Artist' }],
        album: { name: 'The Album' }
      }
    }
    vi.mocked(fetch).mockResolvedValueOnce(new Response(JSON.stringify(payload), { status: 200 }))
    const result = await fetchCurrentlyPlaying('fake-token')
    expect(result?.trackId).toBe('abc123')
    expect(result?.trackName).toBe('My Song')
  })
})
