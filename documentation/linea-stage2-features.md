# Linea — Stage 2: Features (Phases 5–8)

**Status:** Source of truth for guided build
**Scope:** Spotify auth, live now-playing, synced lyrics, settings UI
**Builds on:** Stage 1 (frameless overlay shell, IPC boundary) — see
`linea-stage1-foundation.md` and `linea-stage1-completion.md`
**Application path:** `Linea/` (within `Project-Linea` repository)
**Package manager:** Bun (`bun install`, `bun run dev`, `bun test`)

---

## How to use this document

Same approach as Stage 1: treat each phase as a checkpoint, use "Concepts
to teach" as the bar for understanding (not just working code), have the
learner type code with this as a reference rather than a copy source, and
surface "Common pitfalls" proactively when something looks like one of
them.

One difference from Stage 1: this stage builds **additively** on a real,
already-running codebase, not a fresh scaffold. Code blocks below are
written either as full new files or as explicit additions to existing
files (`main/index.ts`, `ipcChannels.ts`, `renderer.ts`,
`preload/index.ts`) — pay attention to which one each block is, since
overwriting an existing file instead of extending it will silently delete
working Stage 1 code (the click-through toggle, the global shortcut).

Do not pull forward from Stage 3 (packaging, auto-update, production
signing) even if it would be convenient to test something end-to-end —
note it and move on.

---

## 0. Context recap — what's already true

From the Stage 1 completion record, the following exists and should not
be re-derived from the original foundation guide (some details diverged
during the real build):

- App lives in `Linea/`, docs in `documentation/`, inside the
  `Project-Linea` repository.
- Window: frameless, transparent, always-on-top, **resizable**, 320×160,
  positioned top-right, shown after `ready-to-show`.
- Click-through: global shortcut is **`CommandOrControl+Shift+Period`**
  (not `+L` — already owned on the dev machine), plus an in-app button via
  IPC. Both call the same `toggleClickThrough()` / `nextClickThroughState()`
  pair in `src/main/index.ts` / `src/main/clickThrough.ts`.
- Drag region: `-webkit-app-region: drag` on `body`, `no-drag` on
  interactive elements.
- Security: `contextIsolation: true`, `nodeIntegration: false`,
  `sandbox: false` (scaffold default — security comes from the isolation
  flags, not the sandbox flag, for this app).
- `@electron-toolkit/utils` retained (`is.dev`, `ready-to-show` handling).
- IPC channel names centralized in `src/shared/ipcChannels.ts`; preload
  exposes a narrow `window.linea` object via `contextBridge`; renderer
  never touches `ipcRenderer` directly.
- Pure logic lives in its own file, separate from Electron-API calls,
  specifically so it's unit-testable without launching Electron
  (`clickThrough.ts` is the existing example).
- Known, accepted-as-is limitation: the click-through button's label only
  updates on click, not when the global shortcut changes state. Not
  required to fix in Stage 2.

**What Stage 2 adds:** Spotify OAuth (Authorization Code + PKCE), polling
"currently playing," fetching and parsing synced lyrics from LRCLIB, and
a settings layer (opacity/font size) — all following the same
main/preload/renderer split and pure-logic-first testing pattern already
established.

---

## Stage 2 — definition of done

By the end of Phase 8, the learner has:

- A working "Connect Spotify" flow using the system browser, not an
  in-app browser window, ending with an encrypted refresh token on disk.
- A poll loop in the main process that pushes live "now playing" data to
  the renderer, refreshing the access token transparently when it expires.
- Synced lyrics fetched from LRCLIB, parsed from LRC format, cached
  locally per track, with the renderer showing the current line and its
  immediate neighbors, updating smoothly between poll ticks.
- A settings panel (opacity, font size) that persists across restarts in
  a plain JSON file — kept separate from the encrypted token file, since
  one is a secret and the other isn't.
- New pure-logic modules (PKCE helpers, LRC parser, line-index lookup,
  prefs clamping) each with their own passing Vitest file, following the
  exact pattern `clickThrough.ts` set in Stage 1.

Still out of scope: packaging, code signing, auto-update, multi-source
lyrics, anything beyond Spotify.

---

## Phase 5 — Spotify auth (PKCE)

### Goal
Let the user connect their Spotify account from inside Linea, ending with
an access token in memory and a refresh token safely on disk — without
ever embedding a client secret, because a distributed desktop app can't
keep one.

### Concepts to teach
- **OAuth Authorization Code flow**: the standard "redirect to provider,
  come back with a code, exchange the code for a token" shape.
- **Why PKCE specifically**: the classic flow assumes a trusted server
  holds a client secret proving "this is really my app." Linea has no
  server — anyone could extract a secret baked into the binary. PKCE
  replaces the secret with a value generated fresh per login (the
  *verifier*) that's never transmitted until the very last step, paired
  with its hash (the *challenge*) sent earlier. Spotify checks that the
  verifier hashes to the challenge it received — proving continuity
  without ever trusting a stored secret.
- **The loopback redirect**: a desktop app has no public URL for Spotify
  to redirect back to. The fix is to briefly run an actual local HTTP
  server on `127.0.0.1` for the few seconds the login takes, just to catch
  that one redirect and read the authorization code out of its query
  string, then shut the server down.
- **`shell.openExternal`, not an in-app window**: the consent screen opens
  in the user's real, trusted system browser — not a `BrowserWindow`
  Linea controls. If Linea rendered its own login page, it would be
  trivially able to read the user's Spotify password as they typed it;
  routing through the system browser means Linea never sees credentials,
  only the final authorization code.
- **Access token vs. refresh token**: the access token is short-lived
  (about an hour) and is what's sent on every API call; the refresh token
  is long-lived and is what's actually sensitive — it's what gets
  encrypted and stored, never the access token.
- **`safeStorage`**: Electron's wrapper around the OS's own credential
  store (Keychain on macOS, DPAPI on Windows). `encryptString` /
  `decryptString` tie the encrypted blob to the local machine and user
  account — copying the file elsewhere doesn't make it readable.

### One-time setup (Spotify Developer Dashboard)
1. Create an app at the Spotify Developer Dashboard.
2. Add a redirect URI matching exactly what the code below uses:
   `http://127.0.0.1:8888/callback` (must be `127.0.0.1`, not `localhost`
   — Spotify treats them as different strings).
3. Copy the **Client ID** only — PKCE means no client secret is needed.
4. Note: as of the developer platform changes earlier this year, new apps
   in Development Mode require the developer's Spotify account to be
   Premium, are limited to one Development Mode client ID, and cap
   authorized users at five. None of that is a real constraint for
   building and testing Linea yourself.

### Reference implementation

`src/main/config.ts` (new)
```ts
export const SPOTIFY_CLIENT_ID =
  process.env.SPOTIFY_CLIENT_ID ?? '<your-client-id-here>'
export const SPOTIFY_REDIRECT_URI = 'http://127.0.0.1:8888/callback'
export const SPOTIFY_SCOPE = 'user-read-currently-playing'
export const LOOPBACK_PORT = 8888
```

`src/main/spotifyAuth.ts` (new — PKCE + token exchange, pure-ish and
testable where possible)
```ts
import { randomBytes, createHash } from 'node:crypto'

function base64url(buffer: Buffer): string {
  return buffer
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '')
}

export function generateCodeVerifier(): string {
  return base64url(randomBytes(32))
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
}): string {
  const url = new URL('https://accounts.spotify.com/authorize')
  url.searchParams.set('client_id', params.clientId)
  url.searchParams.set('response_type', 'code')
  url.searchParams.set('redirect_uri', params.redirectUri)
  url.searchParams.set('code_challenge_method', 'S256')
  url.searchParams.set('code_challenge', params.codeChallenge)
  url.searchParams.set('scope', params.scope)
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
    body
  })
  if (!response.ok) throw new Error(`Spotify token exchange failed: ${response.status}`)

  const data = await response.json()
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
    body
  })
  if (!response.ok) throw new Error(`Spotify token refresh failed: ${response.status}`)

  const data = await response.json()
  return { accessToken: data.access_token, expiresIn: data.expires_in }
}
```

`src/main/loopbackServer.ts` (new)
```ts
import { createServer, type Server } from 'node:http'

export function startLoopbackServer(
  port: number
): Promise<{ server: Server; code: Promise<string> }> {
  let resolveCode!: (code: string) => void
  let rejectCode!: (err: Error) => void
  const code = new Promise<string>((resolve, reject) => {
    resolveCode = resolve
    rejectCode = reject
  })

  const server = createServer((req, res) => {
    const url = new URL(req.url ?? '', `http://127.0.0.1:${port}`)
    const authCode = url.searchParams.get('code')
    const error = url.searchParams.get('error')

    res.setHeader('Content-Type', 'text/html')
    if (authCode) {
      res.end('<html><body>Linea connected. You can close this tab.</body></html>')
      resolveCode(authCode)
    } else {
      res.end('<html><body>Linea login failed. You can close this tab.</body></html>')
      rejectCode(new Error(error ?? 'No authorization code received'))
    }
  })

  return new Promise((resolveServer) => {
    server.listen(port, '127.0.0.1', () => resolveServer({ server, code }))
  })
}
```

`src/main/tokenStore.ts` (new — `safeStorage`-backed refresh token
persistence)
```ts
import { app, safeStorage } from 'electron'
import { join } from 'node:path'
import { readFileSync, writeFileSync, existsSync, unlinkSync } from 'node:fs'

const authFile = () => join(app.getPath('userData'), 'auth.dat')

export function saveRefreshToken(refreshToken: string): void {
  writeFileSync(authFile(), safeStorage.encryptString(refreshToken))
}

export function loadRefreshToken(): string | null {
  if (!existsSync(authFile())) return null
  return safeStorage.decryptString(readFileSync(authFile()))
}

export function clearRefreshToken(): void {
  if (existsSync(authFile())) unlinkSync(authFile())
}
```

`src/shared/ipcChannels.ts` (add to existing file)
```ts
export const IPC = {
  TOGGLE_CLICK_THROUGH: 'linea:toggle-click-through',
  GET_CLICK_THROUGH_STATE: 'linea:get-click-through-state',
  SPOTIFY_LOGIN: 'linea:spotify-login',
  SPOTIFY_LOGOUT: 'linea:spotify-logout',
  SPOTIFY_AUTH_STATE: 'linea:spotify-auth-state'
} as const
```

`src/main/index.ts` (add — orchestrates the flow above; goes alongside
the existing `createWindow`/`toggleClickThrough` code from Stage 1)
```ts
import { shell, ipcMain } from 'electron'
import { IPC } from '../shared/ipcChannels'
import {
  generateCodeVerifier,
  generateCodeChallenge,
  buildAuthUrl,
  exchangeCodeForTokens
} from './spotifyAuth'
import { startLoopbackServer } from './loopbackServer'
import { saveRefreshToken, loadRefreshToken, clearRefreshToken } from './tokenStore'
import { SPOTIFY_CLIENT_ID, SPOTIFY_REDIRECT_URI, SPOTIFY_SCOPE, LOOPBACK_PORT } from './config'

let accessToken: string | null = null

async function loginToSpotify(): Promise<boolean> {
  const verifier = generateCodeVerifier()
  const challenge = generateCodeChallenge(verifier)
  const { server, code } = await startLoopbackServer(LOOPBACK_PORT)

  const authUrl = buildAuthUrl({
    clientId: SPOTIFY_CLIENT_ID,
    redirectUri: SPOTIFY_REDIRECT_URI,
    codeChallenge: challenge,
    scope: SPOTIFY_SCOPE
  })
  await shell.openExternal(authUrl)

  try {
    const authCode = await code
    const tokens = await exchangeCodeForTokens({
      clientId: SPOTIFY_CLIENT_ID,
      redirectUri: SPOTIFY_REDIRECT_URI,
      code: authCode,
      codeVerifier: verifier
    })
    saveRefreshToken(tokens.refreshToken)
    accessToken = tokens.accessToken
    return true
  } finally {
    server.close()
  }
}

// inside app.whenReady().then(() => { ... }), alongside existing handlers:
ipcMain.handle(IPC.SPOTIFY_LOGIN, () => loginToSpotify())
ipcMain.handle(IPC.SPOTIFY_LOGOUT, () => {
  clearRefreshToken()
  accessToken = null
})
ipcMain.handle(IPC.SPOTIFY_AUTH_STATE, () => accessToken !== null || loadRefreshToken() !== null)
```

`src/preload/index.ts` (add to the existing `contextBridge` call)
```ts
login: () => ipcRenderer.invoke(IPC.SPOTIFY_LOGIN),
logout: () => ipcRenderer.invoke(IPC.SPOTIFY_LOGOUT),
getAuthState: () => ipcRenderer.invoke(IPC.SPOTIFY_AUTH_STATE),
```

### Testing this phase
`tests/spotifyAuth.test.ts` (new)
```ts
import { describe, it, expect } from 'vitest'
import { generateCodeVerifier, generateCodeChallenge } from '../src/main/spotifyAuth'

describe('PKCE helpers', () => {
  it('verifier contains no padding or unsafe base64 characters', () => {
    expect(generateCodeVerifier()).not.toMatch(/[+/=]/)
  })
  it('challenge is deterministic for a given verifier', () => {
    const verifier = generateCodeVerifier()
    expect(generateCodeChallenge(verifier)).toBe(generateCodeChallenge(verifier))
  })
  it('different verifiers produce different challenges', () => {
    expect(generateCodeChallenge(generateCodeVerifier())).not.toBe(
      generateCodeChallenge(generateCodeVerifier())
    )
  })
})
```

### Acceptance criteria
- [ ] Clicking "Connect Spotify" opens the real system browser, not a
      window inside Linea
- [ ] After approving access, the browser tab shows a simple confirmation
      page and Linea reports a connected state
- [ ] `auth.dat` exists in the app's user data directory and is unreadable
      as plain text
- [ ] Restarting the app and checking auth state reflects the stored
      refresh token without requiring login again
- [ ] `bun test` passes the new PKCE tests
- [ ] You can explain, unprompted, why the verifier is generated fresh
      every login while the challenge is what's sent upfront

### Common pitfalls
- **Redirect URI mismatch**: Spotify requires an exact string match
  including trailing slashes — `127.0.0.1` vs `localhost`, or a missing
  `/callback`, fails silently with an error on Spotify's side.
- **Port already in use**: if `8888` is taken by something else on the
  dev machine, the loopback server fails to bind — pick a different port
  in `config.ts` and update the redirect URI in both places (code and
  Spotify dashboard) together.
- **Forgetting `server.close()`**: leaves a process listening on the
  loopback port after login completes, which then blocks the next login
  attempt from binding the same port.

---

## Phase 6 — Currently-playing polling

### Goal
Keep Linea's renderer continuously aware of what's playing on Spotify by
polling from the main process and pushing updates — introducing the
**push** side of IPC, as opposed to the **request/response** pattern used
for click-through and login.

### Concepts to teach
- **Push vs. request/response IPC**: `invoke`/`handle` (used so far)
  assumes the renderer asks and main answers once. Polling is the
  opposite shape — main decides when something's worth telling the
  renderer about, with no renderer request triggering each message. That's
  `mainWindow.webContents.send(channel, data)` on the main side, and
  `ipcRenderer.on(channel, listener)` on the renderer side.
- **Subscribe/unsubscribe from preload**: since this is an ongoing stream
  rather than a one-off call, the exposed API should hand back an
  unsubscribe function, so the renderer can clean up listeners instead of
  accumulating them.
- **Access token refresh**: access tokens expire in about an hour; rather
  than waiting for a request to fail, track the expiry time and refresh
  proactively just before it lapses, using the stored refresh token.
- **Polling etiquette**: poll on a fixed interval (a couple of seconds is
  reasonable) rather than as fast as possible — hammering the endpoint
  doesn't make data more "live" in any way that matters here and risks
  rate limiting.
- **204 No Content**: Spotify's currently-playing endpoint returns this
  with an empty body when nothing is playing — that's not an error, it's
  a valid "nothing to show" state and should be handled as one.

### Reference implementation

`src/shared/types.ts` (new — shared between main and renderer, no
Electron/Node dependency)
```ts
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
```

`src/main/spotifyPlayer.ts` (new)
```ts
import type { NowPlaying } from '../shared/types'

export function hasTrackChanged(previous: NowPlaying | null, next: NowPlaying): boolean {
  return previous?.trackId !== next.trackId
}

export async function fetchCurrentlyPlaying(accessToken: string): Promise<NowPlaying | null> {
  const response = await fetch('https://api.spotify.com/v1/me/player/currently-playing', {
    headers: { Authorization: `Bearer ${accessToken}` }
  })

  if (response.status === 204) return null
  if (!response.ok) throw new Error(`Spotify API error: ${response.status}`)

  const data = await response.json()
  return {
    isPlaying: data.is_playing,
    trackId: data.item?.id ?? null,
    trackName: data.item?.name ?? '',
    artistName: data.item?.artists?.[0]?.name ?? '',
    albumName: data.item?.album?.name ?? '',
    durationMs: data.item?.duration_ms ?? 0,
    progressMs: data.progress_ms ?? 0,
    fetchedAt: Date.now()
  }
}
```

`src/shared/ipcChannels.ts` (add)
```ts
NOW_PLAYING: 'linea:now-playing',
```

`src/main/index.ts` (add — the poll loop; lives alongside the auth code
from Phase 5)
```ts
import { fetchCurrentlyPlaying, hasTrackChanged } from './spotifyPlayer'
import { refreshAccessToken } from './spotifyAuth'
import { loadRefreshToken } from './tokenStore'

let tokenExpiresAt = 0
let lastNowPlaying: import('../shared/types').NowPlaying | null = null

async function ensureFreshAccessToken(): Promise<string | null> {
  if (accessToken && Date.now() < tokenExpiresAt - 30_000) return accessToken
  const refreshToken = loadRefreshToken()
  if (!refreshToken) return null
  const { accessToken: newToken, expiresIn } = await refreshAccessToken({
    clientId: SPOTIFY_CLIENT_ID,
    refreshToken
  })
  accessToken = newToken
  tokenExpiresAt = Date.now() + expiresIn * 1000
  return accessToken
}

function startPolling(): void {
  setInterval(async () => {
    const token = await ensureFreshAccessToken()
    if (!token || !mainWindow) return

    const nowPlaying = await fetchCurrentlyPlaying(token)
    if (!nowPlaying) return

    mainWindow.webContents.send(IPC.NOW_PLAYING, nowPlaying)

    if (hasTrackChanged(lastNowPlaying, nowPlaying)) {
      // Phase 7 hooks in here — fetch lyrics for the new track
    }
    lastNowPlaying = nowPlaying
  }, 2000)
}

// call startPolling() inside app.whenReady().then(() => { ... }) after createWindow()
```

`src/preload/index.ts` (add)
```ts
onNowPlaying: (callback: (data: NowPlaying) => void) => {
  const listener = (_event: unknown, data: NowPlaying) => callback(data)
  ipcRenderer.on(IPC.NOW_PLAYING, listener)
  return () => ipcRenderer.removeListener(IPC.NOW_PLAYING, listener)
},
```
(Add the matching type to `src/renderer/src/linea.d.ts` and import
`NowPlaying` from `src/shared/types`.)

### Acceptance criteria
- [ ] Playing/pausing/skipping tracks on Spotify is reflected in the
      renderer within a couple of seconds, without any user action in Linea
- [ ] Leaving Spotify paused or idle doesn't throw errors — the 204 case is
      handled as "nothing playing," not as a failure
- [ ] Letting the app sit past an hour keeps working without re-login
      (token refresh is happening silently)
- [ ] You can explain why this phase uses `send`/`on` while click-through
      and login use `invoke`/`handle`

### Common pitfalls
- **Forgetting the 204 check**: calling `response.json()` on an empty 204
  body throws, which looks like a Spotify API failure but is actually a
  normal "nothing playing" response misread.
- **Polling too aggressively**: sub-second intervals don't make the data
  meaningfully more current (Spotify's own position data isn't that
  granular) and increase the chance of being rate-limited.
- **Token refresh race**: if two poll ticks both detect an expired token
  and both try to refresh simultaneously, you can end up with two
  refresh calls in flight. Not a problem at a 2-second interval with a
  30-second refresh buffer, but worth knowing as a real edge case before
  shortening the interval later.

---

## Phase 7 — Lyrics fetch & sync engine

### Goal
Given the live track data from Phase 6, fetch synced lyrics from LRCLIB,
parse the LRC timestamp format, cache results per track, and compute which
line should be showing at any given moment — smoothly, not just once per
poll tick.

### Concepts to teach
- **LRCLIB**: a free, no-auth-required lyrics API. Its `get` endpoint takes
  track/artist/album/duration and returns a `syncedLyrics` field in LRC
  format when available.
- **LRC format**: each line is tagged `[mm:ss.xx]text` — minutes, seconds,
  hundredths, then the line itself. Parsing it is a single regex per line.
- **Shared pure logic**: the LRC parser and the "which line is current"
  lookup have no Electron or Node dependency at all — they're just data
  transformations. Putting them in `src/shared/` (rather than
  `src/main/`) means the *renderer* can import and use them directly too,
  which matters for the next part.
- **Local position interpolation**: the poll loop only pushes a position
  every ~2 seconds, but lyrics need to feel continuous. The fix is cheap:
  store the last known position alongside the timestamp it was captured
  at, and in the renderer, continuously estimate the *current* position as
  "last known position + time elapsed since it was captured" — recomputed
  on every animation frame, not just when a new poll update arrives.
- **File-based caching, not a database**: lyrics for a given track don't
  change, so once fetched they're written to a small JSON file per track
  ID under the app's user data directory — no need for anything heavier.

### Reference implementation

`src/shared/lyrics.ts` (new — pure, importable by both main and renderer)
```ts
export interface LyricLine {
  timeMs: number
  text: string
}

const LRC_LINE = /\[(\d{2}):(\d{2})(?:\.(\d{2,3}))?\](.*)/

export function parseLrc(syncedLyrics: string): LyricLine[] {
  return syncedLyrics
    .split('\n')
    .map((line) => line.match(LRC_LINE))
    .filter((match): match is RegExpMatchArray => match !== null)
    .map((match) => {
      const [, minutes, seconds, fraction = '0', text] = match
      const ms =
        Number(minutes) * 60_000 +
        Number(seconds) * 1000 +
        Number(fraction.padEnd(3, '0').slice(0, 3))
      return { timeMs: ms, text: text.trim() }
    })
}

export function getCurrentLineIndex(lines: LyricLine[], positionMs: number): number {
  let index = -1
  for (const line of lines) {
    if (line.timeMs <= positionMs) index++
    else break
  }
  return index
}

export function estimatePositionMs(params: {
  progressMs: number
  fetchedAt: number
  isPlaying: boolean
}): number {
  if (!params.isPlaying) return params.progressMs
  return params.progressMs + (Date.now() - params.fetchedAt)
}
```

`src/main/lyricsCache.ts` (new — network fetch + disk cache, Electron/Node
dependent, so stays out of `shared/`)
```ts
import { app } from 'electron'
import { join } from 'node:path'
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs'
import { parseLrc, type LyricLine } from '../shared/lyrics'

const cacheDir = () => join(app.getPath('userData'), 'lyrics-cache')
const cacheFile = (trackId: string) => join(cacheDir(), `${trackId}.json`)

export async function getLyricsForTrack(params: {
  trackId: string
  trackName: string
  artistName: string
  albumName: string
  durationSec: number
}): Promise<LyricLine[]> {
  if (existsSync(cacheFile(params.trackId))) {
    return JSON.parse(readFileSync(cacheFile(params.trackId), 'utf-8'))
  }

  const url = new URL('https://lrclib.net/api/get')
  url.searchParams.set('track_name', params.trackName)
  url.searchParams.set('artist_name', params.artistName)
  url.searchParams.set('album_name', params.albumName)
  url.searchParams.set('duration', String(params.durationSec))

  const response = await fetch(url)
  if (!response.ok) return []

  const data = await response.json()
  const lines = data.syncedLyrics ? parseLrc(data.syncedLyrics) : []

  mkdirSync(cacheDir(), { recursive: true })
  writeFileSync(cacheFile(params.trackId), JSON.stringify(lines))
  return lines
}
```

`src/shared/ipcChannels.ts` (add)
```ts
LYRICS_UPDATE: 'linea:lyrics-update',
```

`src/main/index.ts` (fills in the Phase 6 placeholder)
```ts
import { getLyricsForTrack } from './lyricsCache'

// replace the Phase 6 comment "// Phase 7 hooks in here..." with:
if (nowPlaying.trackId) {
  const lines = await getLyricsForTrack({
    trackId: nowPlaying.trackId,
    trackName: nowPlaying.trackName,
    artistName: nowPlaying.artistName,
    albumName: nowPlaying.albumName,
    durationSec: Math.round(nowPlaying.durationMs / 1000)
  })
  mainWindow.webContents.send(IPC.LYRICS_UPDATE, lines)
}
```

`src/preload/index.ts` (add)
```ts
onLyricsUpdate: (callback: (lines: LyricLine[]) => void) => {
  const listener = (_event: unknown, lines: LyricLine[]) => callback(lines)
  ipcRenderer.on(IPC.LYRICS_UPDATE, listener)
  return () => ipcRenderer.removeListener(IPC.LYRICS_UPDATE, listener)
},
```

`src/renderer/src/renderer.ts` (add — combines the pushed lyric lines with
locally-interpolated position; this is the first renderer code that
imports from `shared/` directly)
```ts
import { getCurrentLineIndex, estimatePositionMs } from '../../shared/lyrics'
import type { LyricLine } from '../../shared/lyrics'
import type { NowPlaying } from '../../shared/types'

let currentLines: LyricLine[] = []
let latestNowPlaying: NowPlaying | null = null

window.linea.onLyricsUpdate((lines) => {
  currentLines = lines
})

window.linea.onNowPlaying((data) => {
  latestNowPlaying = data
})

function renderCurrentLine(): void {
  if (latestNowPlaying && currentLines.length > 0) {
    const positionMs = estimatePositionMs(latestNowPlaying)
    const index = getCurrentLineIndex(currentLines, positionMs)
    // Phase 8 wires this index into the actual lyric display element
  }
  requestAnimationFrame(renderCurrentLine)
}
requestAnimationFrame(renderCurrentLine)
```

### Testing this phase
`tests/lyrics.test.ts` (new)
```ts
import { describe, it, expect } from 'vitest'
import { parseLrc, getCurrentLineIndex } from '../src/shared/lyrics'

const sample = '[00:00.00]Line one\n[00:02.50]Line two\n[00:05.00]Line three'

describe('parseLrc', () => {
  it('parses timestamps and text', () => {
    const lines = parseLrc(sample)
    expect(lines).toHaveLength(3)
    expect(lines[1]).toEqual({ timeMs: 2500, text: 'Line two' })
  })
})

describe('getCurrentLineIndex', () => {
  const lines = parseLrc(sample)
  it('returns the first line at time zero', () => {
    expect(getCurrentLineIndex(lines, 0)).toBe(0)
  })
  it('returns the right line mid-song', () => {
    expect(getCurrentLineIndex(lines, 3000)).toBe(1)
  })
  it('returns the last line after the song ends', () => {
    expect(getCurrentLineIndex(lines, 999_999)).toBe(2)
  })
})
```

### Acceptance criteria
- [ ] Playing a song with known lyrics on LRCLIB results in the correct
      line being identifiable at any given position
- [ ] Switching tracks triggers exactly one lyrics fetch, not one per poll
      tick (verify via a console log or breakpoint in `getLyricsForTrack`)
- [ ] Re-playing a previously played track loads from the local cache file
      instead of hitting the network again
- [ ] `bun test` passes the new LRC parser tests
- [ ] You can explain why `parseLrc` and `getCurrentLineIndex` live in
      `src/shared/` instead of `src/main/`

### Common pitfalls
- **Track found on Spotify but no lyrics on LRCLIB**: a normal, expected
  case — `getLyricsForTrack` returns an empty array, which the renderer
  should treat as "no lyrics available," not an error state.
- **Caching before confirming the response actually had lyrics**: writing
  an empty result to cache means a transient LRCLIB outage gets
  permanently remembered as "no lyrics" for that track — worth deciding
  consciously whether to cache empty results or only cache non-empty ones.
- **Off-by-one in `getCurrentLineIndex`**: the loop assumes lines are
  sorted ascending by `timeMs`, which LRC files generally are — but if a
  malformed file isn't sorted, the result silently becomes wrong rather
  than throwing, which is worth knowing as you're debugging.

---

## Phase 8 — UI & settings

### Goal
Turn the placeholder window into the actual lyric overlay — current line
emphasized, neighboring lines visible but dim — plus a small settings
panel (opacity, font size) that persists across restarts.

### Concepts to teach
- **Secrets vs. preferences storage**: the refresh token is encrypted via
  `safeStorage` because it's sensitive; opacity and font size are not
  sensitive at all and don't need encryption — they're plain JSON. Mixing
  the two into one file would mean re-deriving the encryption key just to
  read a font size, for no security benefit.
- **`invoke`/`handle` is the right shape again here**: unlike now-playing
  and lyrics (continuous push), reading/writing settings is a discrete
  request with a clear response — back to the pattern from Phase 5's
  login/logout.
- **Clamping, not just storing**: prefs read from disk could in theory be
  corrupted or hand-edited into an invalid range; validating/clamping on
  every read (not just on write) keeps a bad file from producing a broken
  UI rather than just a slightly wrong one.

### Reference implementation

`src/shared/types.ts` (add)
```ts
export interface Prefs {
  opacity: number
  fontSize: number
}
```

`src/main/prefs.ts` (new)
```ts
import { app } from 'electron'
import { join } from 'node:path'
import { readFileSync, writeFileSync, existsSync } from 'node:fs'
import type { Prefs } from '../shared/types'

const prefsFile = () => join(app.getPath('userData'), 'prefs.json')
const DEFAULT_PREFS: Prefs = { opacity: 0.9, fontSize: 16 }

export function clampPrefs(input: Partial<Prefs>): Prefs {
  return {
    opacity: Math.min(1, Math.max(0.2, input.opacity ?? DEFAULT_PREFS.opacity)),
    fontSize: Math.min(28, Math.max(12, input.fontSize ?? DEFAULT_PREFS.fontSize))
  }
}

export function loadPrefs(): Prefs {
  if (!existsSync(prefsFile())) return DEFAULT_PREFS
  return clampPrefs(JSON.parse(readFileSync(prefsFile(), 'utf-8')))
}

export function savePrefs(partial: Partial<Prefs>): Prefs {
  const next = clampPrefs({ ...loadPrefs(), ...partial })
  writeFileSync(prefsFile(), JSON.stringify(next))
  return next
}
```

`src/shared/ipcChannels.ts` (add)
```ts
GET_PREFS: 'linea:get-prefs',
SET_PREFS: 'linea:set-prefs',
```

`src/main/index.ts` (add)
```ts
import { loadPrefs, savePrefs } from './prefs'

ipcMain.handle(IPC.GET_PREFS, () => loadPrefs())
ipcMain.handle(IPC.SET_PREFS, (_event, partial) => savePrefs(partial))
```

`src/preload/index.ts` (add)
```ts
getPrefs: () => ipcRenderer.invoke(IPC.GET_PREFS),
setPrefs: (partial: Partial<Prefs>) => ipcRenderer.invoke(IPC.SET_PREFS, partial),
```

`src/renderer/src/renderer.ts` (replace the Phase 7 placeholder comment
with actual rendering, and add the settings panel)
```ts
const lyricEl = document.getElementById('lyric')!
const prevEl = document.getElementById('lyric-prev')!
const nextEl = document.getElementById('lyric-next')!

function renderCurrentLine(): void {
  if (latestNowPlaying && currentLines.length > 0) {
    const positionMs = estimatePositionMs(latestNowPlaying)
    const index = getCurrentLineIndex(currentLines, positionMs)
    lyricEl.textContent = currentLines[index]?.text ?? ''
    prevEl.textContent = currentLines[index - 1]?.text ?? ''
    nextEl.textContent = currentLines[index + 1]?.text ?? ''
  }
  requestAnimationFrame(renderCurrentLine)
}
requestAnimationFrame(renderCurrentLine)

window.linea.getPrefs().then((prefs) => {
  document.body.style.opacity = String(prefs.opacity)
  lyricEl.style.fontSize = `${prefs.fontSize}px`
})

const opacitySlider = document.getElementById('opacity-slider') as HTMLInputElement
opacitySlider.addEventListener('input', async () => {
  const prefs = await window.linea.setPrefs({ opacity: Number(opacitySlider.value) })
  document.body.style.opacity = String(prefs.opacity)
})
```

`src/renderer/assets/main.css` (add)
```css
#lyric-prev, #lyric-next {
  opacity: 0.4;
  font-size: 0.8em;
}
#lyric {
  font-weight: 500;
  transition: opacity 0.15s ease;
}
```

### Testing this phase
`tests/prefs.test.ts` (new)
```ts
import { describe, it, expect } from 'vitest'
import { clampPrefs } from '../src/main/prefs'

describe('clampPrefs', () => {
  it('clamps opacity into [0.2, 1]', () => {
    expect(clampPrefs({ opacity: 5 }).opacity).toBe(1)
    expect(clampPrefs({ opacity: -2 }).opacity).toBe(0.2)
  })
  it('falls back to defaults for missing fields', () => {
    expect(clampPrefs({}).fontSize).toBe(16)
  })
})
```

### Acceptance criteria
- [ ] Current lyric line is visually distinct from the previous/next lines
- [ ] Adjusting the opacity slider updates the window live and persists
      after restarting the app
- [ ] An invalid/out-of-range value written directly into `prefs.json` by
      hand still produces a valid, clamped UI on next launch
- [ ] `bun test` passes the new prefs tests
- [ ] You can explain why prefs and the refresh token are stored in two
      separate files instead of one

### Common pitfalls
- **Settings UI in the draggable region**: any new interactive element
  (the slider) needs `-webkit-app-region: no-drag`, same issue as the
  click-through button in Stage 1 — easy to forget on a new element.
- **Clamping only on write, not on read**: if `prefs.json` is ever hand-
  edited or corrupted, skipping the read-time clamp lets a bad value reach
  the UI directly.

---

## Stage 2 — exit checklist

- [ ] Spotify login completes via the system browser and survives an app
      restart without re-prompting
- [ ] Now-playing data updates the renderer continuously while music plays,
      handling paused/idle (204) correctly
- [ ] Lyrics are fetched once per track change, cached locally, and the
      correct line is identifiable at any position
- [ ] Renderer shows the current line plus dimmed neighbors, updating
      smoothly between poll ticks via local position interpolation
- [ ] Settings (opacity, font size) persist across restarts in a separate
      file from the encrypted auth token
- [ ] All four new pure-logic modules have passing Vitest files
      (`spotifyAuth`, `lyrics`/LRC parsing, `prefs`)
- [ ] Learner can explain, unprompted: why PKCE replaces a client secret,
      why now-playing uses push IPC while login/prefs use request-response,
      why lyric sync logic lives in `shared/` instead of `main/`, and why
      secrets and preferences are stored separately

If any of these aren't true, stay in Stage 2 — Stage 3 (testing pass,
packaging, distribution) assumes a feature-complete app, not a partially
wired one.

---

## Glossary (additions to Stage 1's list)

| Term | Meaning |
|---|---|
| PKCE | Proof Key for Code Exchange — OAuth extension letting a public client (no server secret) prove continuity via a verifier/challenge pair |
| Code verifier | A random value generated fresh per login attempt, kept local until the final token exchange |
| Code challenge | SHA-256 hash of the verifier, sent upfront when starting the login |
| Loopback redirect | Briefly running a local HTTP server on `127.0.0.1` to catch an OAuth redirect, since a desktop app has no public URL |
| Access token | Short-lived credential sent on every API call |
| Refresh token | Long-lived, sensitive credential used to obtain new access tokens without re-login |
| `safeStorage` | Electron API encrypting strings using the OS's native credential store |
| Push IPC (`send`/`on`) | Main-initiated, ongoing messages to the renderer — contrast with `invoke`/`handle` |
| LRC format | Plain-text lyrics format with per-line `[mm:ss.xx]` timestamps |
| Position interpolation | Estimating "where we are now" between infrequent updates, using elapsed time since the last known position |

---

## File tree at end of Stage 2

```
Linea/
├── electron.vite.config.ts
├── package.json
├── tsconfig.json / tsconfig.node.json / tsconfig.web.json
├── src/
│   ├── main/
│   │   ├── index.ts
│   │   ├── clickThrough.ts
│   │   ├── config.ts            # new
│   │   ├── spotifyAuth.ts       # new
│   │   ├── loopbackServer.ts    # new
│   │   ├── tokenStore.ts        # new
│   │   ├── spotifyPlayer.ts     # new
│   │   ├── lyricsCache.ts       # new
│   │   └── prefs.ts             # new
│   ├── preload/
│   │   ├── index.ts
│   │   └── index.d.ts
│   ├── shared/
│   │   ├── ipcChannels.ts
│   │   ├── types.ts             # new
│   │   └── lyrics.ts            # new — pure, used by main and renderer
│   └── renderer/
│       ├── index.html
│       ├── assets/
│       │   ├── main.css
│       │   └── base.css
│       └── src/
│           ├── renderer.ts
│           └── linea.d.ts
└── tests/
    ├── clickThrough.test.ts
    ├── spotifyAuth.test.ts      # new
    ├── lyrics.test.ts           # new
    └── prefs.test.ts            # new
```

---

## Carried-forward known limitations (not required to fix in Stage 2)

- Click-through button label doesn't sync when toggled via the global
  shortcut.
- Stale scaffold CSS and the unused `preload/index.d.ts` `window.electron`
  declaration remain.
- `electron-builder` / `electron-updater` present from scaffold, still
  unexercised — that's Stage 3.

---

## References

- [Stage 1 build guide](./linea-stage1-foundation.md)
- [Stage 1 completion record](./linea-stage1-completion.md)
- [Spotify Web API — Authorization Code with PKCE](https://developer.spotify.com/documentation/web-api/tutorials/code-pkce-flow)
- [LRCLIB API](https://lrclib.net/docs)
- [Electron `safeStorage`](https://www.electronjs.org/docs/latest/api/safe-storage)

---

## Sign-off (fill in on completion)

| Field | Value |
|---|---|
| Stage | 2 — Features (Phases 5–8) |
| Result | _pending_ |
| Recorded | _pending_ |
| Next stage | Stage 3 — Testing pass, packaging & distribution |
