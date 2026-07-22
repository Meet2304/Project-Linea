import { app, shell, BrowserWindow, globalShortcut, screen, ipcMain } from 'electron'
import { join } from 'path'
import { electronApp, optimizer, is } from '@electron-toolkit/utils'
import icon from '../../resources/icon.png?asset'
import { IPC } from '../shared/ipcChannels'
import type {
  ApiResult,
  PlayerCommand,
  PlayerErrorReason,
  PlayerState,
  Prefs
} from '../shared/types'
import type { LyricLine } from '../shared/lyrics'
import { estimatePositionMs } from '../shared/lyrics'
import { nextPollDelay } from '../shared/pollPolicy'
import { nextClickThroughState } from './clickThrough'
import {
  generateCodeVerifier,
  generateCodeChallenge,
  buildAuthUrl,
  exchangeCodeForTokens
} from './spotifyAuth'
import { startLoopbackServer } from './loopbackServer'
import { saveRefreshToken, clearRefreshToken } from './tokenStore'
import { SPOTIFY_CLIENT_ID, SPOTIFY_REDIRECT_URI, SPOTIFY_SCOPE, LOOPBACK_PORT } from './config'
import { setAccessToken, clearAccessToken, hasAuth } from './spotifyClient'
import * as player from './spotifyPlayer'
import { getLyricsForTrack } from './lyricsCache'
import { loadPrefs, savePrefs } from './prefs'
import { initAutoUpdater } from './updater'

// Window hugs the 384px panel + a 12px shadow gutter per side; height
// is driven programmatically by the lyrics expanded/compact pref.
const WINDOW_WIDTH = 408
const COMPACT_HEIGHT = 232
const EXPANDED_HEIGHT = 470

let mainWindow: BrowserWindow | null = null
let clickThrough = false
let lastState: PlayerState | null = null
let pollTimer: ReturnType<typeof setTimeout> | null = null
/** Old refresh tokens lack the transport scopes — degrade to read-only. */
let scopeLimited = false
let scopeToastShown = false

const likedCache = new Map<string, boolean>()
const LIKED_CACHE_MAX = 50

function rememberLiked(trackId: string, liked: boolean): void {
  if (likedCache.size >= LIKED_CACHE_MAX && !likedCache.has(trackId)) {
    const oldest = likedCache.keys().next().value
    if (oldest !== undefined) likedCache.delete(oldest)
  }
  likedCache.set(trackId, liked)
}

function windowHeight(prefs: Prefs): number {
  return prefs.lyricsExpanded ? EXPANDED_HEIGHT : COMPACT_HEIGHT
}

function createWindow(): void {
  const { width } = screen.getPrimaryDisplay().workAreaSize
  const prefs = loadPrefs()

  mainWindow = new BrowserWindow({
    width: WINDOW_WIDTH,
    height: windowHeight(prefs),
    x: width - WINDOW_WIDTH - 20,
    y: 40,
    frame: false,
    transparent: true,
    backgroundColor: '#00000000',
    alwaysOnTop: prefs.pinned,
    resizable: true,
    minWidth: WINDOW_WIDTH,
    minHeight: COMPACT_HEIGHT,
    skipTaskbar: true,
    show: false,
    autoHideMenuBar: true,
    ...(process.platform === 'linux' ? { icon } : {}),
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: false,
      contextIsolation: true,
      nodeIntegration: false
    }
  })
  const win = mainWindow

  win.on('ready-to-show', () => {
    win.show()
  })

  win.webContents.setWindowOpenHandler((details) => {
    shell.openExternal(details.url)
    return { action: 'deny' }
  })

  if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
    win.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    win.loadFile(join(__dirname, '../renderer/index.html'))
  }
}

function toggleClickThrough(): void {
  if (!mainWindow) return
  clickThrough = nextClickThroughState(clickThrough)
  // forward:true keeps hover events flowing so the panel can dim itself.
  mainWindow.setIgnoreMouseEvents(clickThrough, { forward: true })
  mainWindow.webContents.send(IPC.CLICK_THROUGH_CHANGED, clickThrough)
}

function sendNowPlaying(data: PlayerState | null): void {
  mainWindow?.webContents.send(IPC.NOW_PLAYING, data)
}

function sendLyrics(lines: LyricLine[]): void {
  mainWindow?.webContents.send(IPC.LYRICS_UPDATE, lines)
}

function sendPlayerError(reason: PlayerErrorReason, message: string): void {
  mainWindow?.webContents.send(IPC.PLAYER_ERROR, { reason, message })
}

// ------------------------------------------------------------------
// Auth
// ------------------------------------------------------------------
async function loginToSpotify(): Promise<boolean> {
  if (!SPOTIFY_CLIENT_ID) {
    throw new Error(
      'Missing MAIN_VITE_SPOTIFY_CLIENT_ID. Add it to Linea/.env and restart the app.'
    )
  }

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
    setAccessToken(tokens.accessToken, tokens.expiresIn)
    // A fresh login carries the full scope set again.
    scopeLimited = false
    scopeToastShown = false
    startPolling()
    return true
  } finally {
    server.close()
  }
}

function logoutFromSpotify(): void {
  clearRefreshToken()
  clearAccessToken()
  stopPolling()
  lastState = null
  likedCache.clear()
  sendNowPlaying(null)
  sendLyrics([])
}

// ------------------------------------------------------------------
// Polling (adaptive: fast while playing, slow while idle, off when
// logged out)
// ------------------------------------------------------------------
function msToTrackEnd(): number | null {
  if (!lastState?.isPlaying || lastState.durationMs <= 0) return null
  return Math.max(0, lastState.durationMs - estimatePositionMs(lastState))
}

function schedulePoll(delayOverrideMs?: number): void {
  if (pollTimer) {
    clearTimeout(pollTimer)
    pollTimer = null
  }
  const delay =
    delayOverrideMs ??
    nextPollDelay({
      authed: hasAuth(),
      isPlaying: lastState?.isPlaying ?? false,
      msToTrackEnd: msToTrackEnd()
    })
  if (delay === null) return
  pollTimer = setTimeout(() => void pollOnce(), delay)
}

async function updateLikedState(trackId: string): Promise<void> {
  const result = await player.checkSaved(trackId)
  if (!result.ok) return
  rememberLiked(trackId, result.data)
  if (lastState?.trackId === trackId && lastState.liked !== result.data) {
    lastState = { ...lastState, liked: result.data }
    sendNowPlaying(lastState)
  }
}

async function refreshLyrics(state: PlayerState): Promise<void> {
  if (!state.trackId) return
  const lines = await getLyricsForTrack({
    trackId: state.trackId,
    trackName: state.trackName,
    artistName: state.artistName,
    albumName: state.albumName,
    durationSec: Math.round(state.durationMs / 1000)
  })
  sendLyrics(lines)
}

async function pollOnce(): Promise<void> {
  pollTimer = null
  try {
    if (!hasAuth() || !mainWindow) return

    let result = scopeLimited
      ? await player.fetchCurrentlyPlayingLegacy()
      : await player.fetchPlaybackState()

    if (!result.ok && result.reason === 'insufficient_scope' && !scopeLimited) {
      scopeLimited = true
      if (!scopeToastShown) {
        scopeToastShown = true
        sendPlayerError('insufficient_scope', 'Reconnect Spotify to enable playback controls')
      }
      result = await player.fetchCurrentlyPlayingLegacy()
    }

    if (!result.ok) {
      if (result.reason === 'rate_limited') {
        schedulePoll(result.retryAfterMs ?? 30_000)
        return
      }
      // Transient failures (network, auth mid-refresh): retry on the
      // idle cadence rather than tearing anything down.
      schedulePoll(10_000)
      return
    }

    const state = result.data
    if (!state) {
      if (lastState !== null) {
        lastState = null
        sendNowPlaying(null)
        sendLyrics([])
      }
      schedulePoll()
      return
    }

    state.liked = state.trackId ? (likedCache.get(state.trackId) ?? null) : null
    const trackChanged = player.hasTrackChanged(lastState, state)
    lastState = state
    sendNowPlaying(state)

    if (trackChanged && state.trackId) {
      if (!scopeLimited) void updateLikedState(state.trackId)
      await refreshLyrics(state)
    }
  } catch (error) {
    console.error('Now-playing poll failed:', error)
  }
  schedulePoll()
}

function startPolling(): void {
  if (pollTimer) return
  void pollOnce()
}

function stopPolling(): void {
  if (pollTimer) {
    clearTimeout(pollTimer)
    pollTimer = null
  }
}

// ------------------------------------------------------------------
// Player commands
// ------------------------------------------------------------------
async function runCommand(cmd: PlayerCommand): Promise<ApiResult<null>> {
  switch (cmd.type) {
    case 'play':
      return player.play()
    case 'pause':
      return player.pause()
    case 'next':
      return player.next()
    case 'previous':
      return player.previous()
    case 'seek':
      return player.seek(cmd.positionMs)
    case 'shuffle':
      return player.setShuffle(cmd.state)
    case 'repeat':
      return player.setRepeat(cmd.mode)
    default:
      return { ok: false, reason: 'network' }
  }
}

async function handlePlayerCommand(cmd: PlayerCommand): Promise<ApiResult<null>> {
  const result = await runCommand(cmd)
  if (result.ok) {
    // Spotify's state is eventually consistent — poll quickly to
    // reconcile the optimistic UI.
    schedulePoll(400)
  }
  return result
}

async function handleToggleLike(): Promise<ApiResult<boolean>> {
  const trackId = lastState?.trackId
  if (!trackId) return { ok: false, reason: 'no_device' }
  const current = likedCache.get(trackId) ?? lastState?.liked ?? false
  const result = current ? await player.removeTrack(trackId) : await player.saveTrack(trackId)
  if (!result.ok) return result
  const liked = !current
  rememberLiked(trackId, liked)
  if (lastState?.trackId === trackId) lastState = { ...lastState, liked }
  return { ok: true, data: liked }
}

// ------------------------------------------------------------------
// App lifecycle
// ------------------------------------------------------------------
app.whenReady().then(() => {
  electronApp.setAppUserModelId('com.meet2304.linea')

  app.on('browser-window-created', (_, window) => {
    optimizer.watchWindowShortcuts(window)
  })

  createWindow()
  startPolling()
  initAutoUpdater()

  ipcMain.handle(IPC.TOGGLE_CLICK_THROUGH, () => {
    toggleClickThrough()
    return clickThrough
  })

  ipcMain.handle(IPC.GET_CLICK_THROUGH_STATE, () => clickThrough)

  ipcMain.handle(IPC.SPOTIFY_LOGIN, () => loginToSpotify())
  ipcMain.handle(IPC.SPOTIFY_LOGOUT, () => {
    logoutFromSpotify()
  })
  ipcMain.handle(IPC.SPOTIFY_AUTH_STATE, () => hasAuth())

  ipcMain.handle(IPC.PLAYER_COMMAND, (_event, cmd: PlayerCommand) => handlePlayerCommand(cmd))
  ipcMain.handle(IPC.TOGGLE_LIKE, () => handleToggleLike())

  ipcMain.handle(IPC.SET_PINNED, (_event, pinned: boolean) => {
    mainWindow?.setAlwaysOnTop(pinned, 'screen-saver')
    savePrefs({ pinned })
  })

  ipcMain.handle(IPC.SET_LYRICS_EXPANDED, (_event, expanded: boolean) => {
    const prefs = savePrefs({ lyricsExpanded: expanded })
    if (mainWindow) {
      const bounds = mainWindow.getBounds()
      mainWindow.setBounds({ ...bounds, height: windowHeight(prefs) })
    }
  })

  ipcMain.handle(IPC.GET_PREFS, () => loadPrefs())
  ipcMain.handle(IPC.SET_PREFS, (_event, partial: Partial<Prefs>) => savePrefs(partial))

  const registered = globalShortcut.register('CommandOrControl+Shift+Period', toggleClickThrough)
  if (!registered) {
    console.error('Global shortcut registration failed — another app may own Ctrl+Shift+Period')
  }

  app.on('activate', function () {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('will-quit', () => {
  globalShortcut.unregisterAll()
  stopPolling()
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})
