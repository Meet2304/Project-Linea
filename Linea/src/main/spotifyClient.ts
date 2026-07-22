import { refreshAccessToken } from './spotifyAuth'
import { loadRefreshToken } from './tokenStore'
import { SPOTIFY_CLIENT_ID } from './config'
import type { ApiResult } from '../shared/types'

const API_BASE = 'https://api.spotify.com'

let accessToken: string | null = null
let tokenExpiresAt = 0

export function setAccessToken(token: string, expiresInSec: number): void {
  accessToken = token
  tokenExpiresAt = Date.now() + expiresInSec * 1000
}

export function clearAccessToken(): void {
  accessToken = null
  tokenExpiresAt = 0
}

export function hasAuth(): boolean {
  return accessToken !== null || loadRefreshToken() !== null
}

export async function ensureFreshAccessToken(): Promise<string | null> {
  if (accessToken && Date.now() < tokenExpiresAt - 30_000) return accessToken
  if (!SPOTIFY_CLIENT_ID) return null

  const refreshToken = loadRefreshToken()
  if (!refreshToken) return null

  const { accessToken: newToken, expiresIn } = await refreshAccessToken({
    clientId: SPOTIFY_CLIENT_ID,
    refreshToken
  })
  setAccessToken(newToken, expiresIn)
  return newToken
}

export interface SpotifyResponse {
  status: number
  body: unknown
}

interface SpotifyErrorBody {
  error?: {
    status?: number
    message?: string
    reason?: string
  }
}

async function parseBody(response: Response): Promise<unknown> {
  const text = await response.text()
  if (!text) return null
  try {
    return JSON.parse(text)
  } catch {
    return null
  }
}

function mapErrorResult(status: number, body: unknown, retryAfterMs?: number): ApiResult<never> {
  const err = (body as SpotifyErrorBody | null)?.error
  if (status === 429) return { ok: false, reason: 'rate_limited', retryAfterMs }
  if (status === 404) return { ok: false, reason: 'no_device' }
  if (status === 403) {
    if (err?.reason === 'PREMIUM_REQUIRED' || /premium/i.test(err?.message ?? '')) {
      return { ok: false, reason: 'premium_required' }
    }
    if (/scope/i.test(err?.message ?? '')) {
      return { ok: false, reason: 'insufficient_scope' }
    }
    return { ok: false, reason: 'premium_required' }
  }
  if (status === 401) return { ok: false, reason: 'auth_expired' }
  return { ok: false, reason: 'network' }
}

/**
 * Fetch against the Spotify Web API with bearer injection and a single
 * 401 → refresh → retry. All failures collapse to a typed reason the
 * renderer can toast.
 */
export async function spotifyFetch(
  path: string,
  init: RequestInit = {}
): Promise<ApiResult<SpotifyResponse>> {
  let token: string | null
  try {
    token = await ensureFreshAccessToken()
  } catch {
    return { ok: false, reason: 'auth_expired' }
  }
  if (!token) return { ok: false, reason: 'auth_expired' }

  const doFetch = (bearer: string): Promise<Response> =>
    fetch(`${API_BASE}${path}`, {
      ...init,
      headers: { ...(init.headers ?? {}), Authorization: `Bearer ${bearer}` }
    })

  let response: Response
  try {
    response = await doFetch(token)
    if (response.status === 401) {
      clearAccessToken()
      const retryToken = await ensureFreshAccessToken()
      if (!retryToken) return { ok: false, reason: 'auth_expired' }
      response = await doFetch(retryToken)
    }
  } catch {
    return { ok: false, reason: 'network' }
  }

  const body = await parseBody(response)
  if (response.ok) return { ok: true, data: { status: response.status, body } }

  const retryAfterSec = Number(response.headers.get('Retry-After'))
  return mapErrorResult(
    response.status,
    body,
    Number.isFinite(retryAfterSec) ? retryAfterSec * 1000 : undefined
  )
}
