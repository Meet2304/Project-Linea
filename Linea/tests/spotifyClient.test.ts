import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

vi.mock('../src/main/tokenStore', () => ({
  loadRefreshToken: vi.fn(() => 'refresh-token'),
  saveRefreshToken: vi.fn(),
  clearRefreshToken: vi.fn()
}))

vi.mock('../src/main/spotifyAuth', () => ({
  refreshAccessToken: vi.fn(async () => ({ accessToken: 'refreshed-token', expiresIn: 3600 }))
}))

vi.mock('../src/main/config', () => ({
  SPOTIFY_CLIENT_ID: 'client-id',
  SPOTIFY_REDIRECT_URI: 'http://127.0.0.1:8888/callback',
  SPOTIFY_SCOPE: 'scope',
  LOOPBACK_PORT: 8888
}))

import { spotifyFetch, setAccessToken, clearAccessToken } from '../src/main/spotifyClient'
import { refreshAccessToken } from '../src/main/spotifyAuth'

const jsonResponse = (
  status: number,
  body: unknown,
  headers: Record<string, string> = {}
): Response => new Response(body === null ? null : JSON.stringify(body), { status, headers })

describe('spotifyFetch', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn())
    clearAccessToken()
  })
  afterEach(() => {
    vi.unstubAllGlobals()
    vi.clearAllMocks()
  })

  it('injects the bearer token', async () => {
    setAccessToken('token-a', 3600)
    vi.mocked(fetch).mockResolvedValueOnce(jsonResponse(200, { ok: true }))

    const result = await spotifyFetch('/v1/me/player')

    expect(result.ok).toBe(true)
    const [url, init] = vi.mocked(fetch).mock.calls[0]
    expect(String(url)).toBe('https://api.spotify.com/v1/me/player')
    expect((init?.headers as Record<string, string>).Authorization).toBe('Bearer token-a')
  })

  it('refreshes once and retries once on 401', async () => {
    setAccessToken('stale-token', 3600)
    vi.mocked(fetch)
      .mockResolvedValueOnce(jsonResponse(401, { error: { message: 'expired' } }))
      .mockResolvedValueOnce(jsonResponse(200, { ok: true }))

    const result = await spotifyFetch('/v1/me/player')

    expect(result.ok).toBe(true)
    expect(refreshAccessToken).toHaveBeenCalledTimes(1)
    expect(fetch).toHaveBeenCalledTimes(2)
    const [, retryInit] = vi.mocked(fetch).mock.calls[1]
    expect((retryInit?.headers as Record<string, string>).Authorization).toBe(
      'Bearer refreshed-token'
    )
  })

  it('maps 429 to rate_limited with Retry-After', async () => {
    setAccessToken('token-a', 3600)
    vi.mocked(fetch).mockResolvedValueOnce(jsonResponse(429, null, { 'Retry-After': '5' }))

    const result = await spotifyFetch('/v1/me/player')

    expect(result).toEqual({ ok: false, reason: 'rate_limited', retryAfterMs: 5000 })
  })

  it('maps 403 PREMIUM_REQUIRED to premium_required', async () => {
    setAccessToken('token-a', 3600)
    vi.mocked(fetch).mockResolvedValueOnce(
      jsonResponse(403, {
        error: {
          status: 403,
          reason: 'PREMIUM_REQUIRED',
          message: 'Player command failed: Premium required'
        }
      })
    )

    const result = await spotifyFetch('/v1/me/player/play', { method: 'PUT' })

    expect(result).toMatchObject({ ok: false, reason: 'premium_required' })
  })

  it('maps 403 insufficient scope to insufficient_scope', async () => {
    setAccessToken('token-a', 3600)
    vi.mocked(fetch).mockResolvedValueOnce(
      jsonResponse(403, { error: { status: 403, message: 'Insufficient client scope' } })
    )

    const result = await spotifyFetch('/v1/me/player')

    expect(result).toMatchObject({ ok: false, reason: 'insufficient_scope' })
  })

  it('maps 403 player/device failures to no_device (not premium)', async () => {
    setAccessToken('token-a', 3600)
    vi.mocked(fetch).mockResolvedValueOnce(
      jsonResponse(403, {
        error: {
          status: 403,
          reason: 'NO_ACTIVE_DEVICE',
          message: 'Player command failed: No active device found'
        }
      })
    )

    const result = await spotifyFetch('/v1/me/player/play', { method: 'PUT' })

    expect(result).toMatchObject({ ok: false, reason: 'no_device' })
  })

  // This is what an account missing from the Spotify app's Development Mode
  // allowlist gets on every single call. It used to fall through to `network`,
  // where the poll loop retried it as a blip and never told anyone — the app
  // connected and then showed "Nothing playing" forever.
  it('maps the Development Mode allowlist 403 to not_registered', async () => {
    setAccessToken('token-a', 3600)
    vi.mocked(fetch).mockResolvedValueOnce(
      jsonResponse(403, {
        error: { status: 403, message: 'User not registered in the Developer Dashboard' }
      })
    )

    const result = await spotifyFetch('/v1/me/player')

    expect(result).toMatchObject({ ok: false, reason: 'not_registered' })
  })

  it('maps unknown 403s to network instead of assuming Premium', async () => {
    setAccessToken('token-a', 3600)
    vi.mocked(fetch).mockResolvedValueOnce(
      jsonResponse(403, { error: { status: 403, message: 'Forbidden' } })
    )

    const result = await spotifyFetch('/v1/me/player/play', { method: 'PUT' })

    expect(result).toMatchObject({ ok: false, reason: 'network' })
  })

  it('maps 404 to no_device', async () => {
    setAccessToken('token-a', 3600)
    vi.mocked(fetch).mockResolvedValueOnce(jsonResponse(404, { error: { message: 'No device' } }))

    const result = await spotifyFetch('/v1/me/player/next', { method: 'POST' })

    expect(result).toMatchObject({ ok: false, reason: 'no_device' })
  })

  it('returns auth_expired when the refresh itself fails', async () => {
    vi.mocked(refreshAccessToken).mockRejectedValueOnce(new Error('revoked'))

    const result = await spotifyFetch('/v1/me/player')

    expect(result).toMatchObject({ ok: false, reason: 'auth_expired' })
    expect(fetch).not.toHaveBeenCalled()
  })

  it('maps thrown fetch errors to network', async () => {
    setAccessToken('token-a', 3600)
    vi.mocked(fetch).mockRejectedValueOnce(new Error('offline'))

    const result = await spotifyFetch('/v1/me/player')

    expect(result).toMatchObject({ ok: false, reason: 'network' })
  })
})
