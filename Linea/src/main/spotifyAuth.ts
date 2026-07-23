import { randomBytes, createHash } from 'node:crypto'

interface SpotifyTokenResponse {
  access_token: string
  refresh_token?: string
  expires_in: number
}

function base64url(buffer: Buffer): string {
  return buffer.toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

export function generateCodeVerifier(): string {
  return base64url(randomBytes(32))
}

/** Random OAuth `state` — ties the loopback callback to this login attempt. */
export function generateState(): string {
  return base64url(randomBytes(16))
}

export function generateCodeChallenge(verifier: string): string {
  const hash = createHash('sha256').update(verifier).digest()
  return base64url(hash)
}

export function buildAuthUrl(params: {
  clientId: string
  redirectUri: string
  codeChallenge: string
  scope: string
  state: string
}): string {
  const url = new URL('https://accounts.spotify.com/authorize')
  url.searchParams.set('client_id', params.clientId)
  url.searchParams.set('response_type', 'code')
  url.searchParams.set('redirect_uri', params.redirectUri)
  url.searchParams.set('code_challenge_method', 'S256')
  url.searchParams.set('code_challenge', params.codeChallenge)
  url.searchParams.set('scope', params.scope)
  url.searchParams.set('state', params.state)
  return url.toString()
}

export async function exchangeCodeForTokens(params: {
  clientId: string
  redirectUri: string
  code: string
  codeVerifier: string
}): Promise<{ accessToken: string; refreshToken: string; expiresIn: number }> {
  const body = new URLSearchParams({
    grant_type: 'authorization_code',
    code: params.code,
    redirect_uri: params.redirectUri,
    client_id: params.clientId,
    code_verifier: params.codeVerifier
  })

  const response = await fetch('https://accounts.spotify.com/api/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body,
    signal: AbortSignal.timeout(15_000)
  })
  if (!response.ok) throw new Error(`Spotify token exchange failed: ${response.status}`)

  const data = (await response.json()) as SpotifyTokenResponse
  if (!data.refresh_token) {
    throw new Error('Spotify token exchange did not return a refresh token')
  }

  return {
    accessToken: data.access_token,
    refreshToken: data.refresh_token,
    expiresIn: data.expires_in
  }
}

export async function refreshAccessToken(params: {
  clientId: string
  refreshToken: string
}): Promise<{ accessToken: string; expiresIn: number }> {
  const body = new URLSearchParams({
    grant_type: 'refresh_token',
    refresh_token: params.refreshToken,
    client_id: params.clientId
  })

  const response = await fetch('https://accounts.spotify.com/api/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body,
    signal: AbortSignal.timeout(15_000)
  })
  if (!response.ok) throw new Error(`Spotify token refresh failed: ${response.status}`)

  const data = (await response.json()) as SpotifyTokenResponse
  return { accessToken: data.access_token, expiresIn: data.expires_in }
}
