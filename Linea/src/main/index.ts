import {
  app,
  shell,
  BrowserWindow,
  globalShortcut,
  screen,
  ipcMain,
  Tray,
  Menu,
  nativeImage,
  session
} from 'electron'
import { join } from 'path'
import { electronApp, optimizer, is } from '@electron-toolkit/utils'
import icon from '../../resources/icon.png?asset'
import { IPC } from '../shared/ipcChannels'
import type {
  ApiResult,
  PlayerCommand,
  PlayerErrorReason,
  PlayerState,
  Prefs,
  WindowBounds
} from '../shared/types'
import type { LyricsResult } from '../shared/lyrics'
import { estimatePositionMs } from '../shared/lyrics'
import { nextPollDelay } from '../shared/pollPolicy'
import { nextClickThroughState } from './clickThrough'
import {
  generateCodeVerifier,
  generateCodeChallenge,
  generateState,
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
import {
  initAutoUpdater,
  getUpdateState,
  checkForUpdate,
  installUpdate,
  stopUpdateChecks
} from './updater'

// The panel fills the window minus a 30px shadow gutter per side. The
// window is freely resizable (custom grips in the renderer drive
// SET_WINDOW_BOUNDS); these are the launch and floor sizes.
const INITIAL_WIDTH = 600
const INITIAL_HEIGHT = 250
const MIN_WIDTH = 372
const MIN_HEIGHT = 150
/** Transparent shadow ring around the panel — must match main.css `body` padding. */
const SHADOW_GUTTER = 30
/** Breathing room between the visible panel and the work-area corner. */
const CORNER_MARGIN = 16

let mainWindow: BrowserWindow | null = null
let tray: Tray | null = null
let clickThrough = false
/** True while the cursor is over the visible panel (not the shadow gutter). */
let pointerOverPanel = false
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

/** Set the window height only (preset sizing), keeping the current
 *  x/y so it grows from its current anchor. */
function resizeWindowTo(height: number): void {
  if (!mainWindow || mainWindow.isDestroyed()) return
  const { height: availH } = screen.getPrimaryDisplay().workAreaSize
  const clamped = Math.round(Math.max(MIN_HEIGHT, Math.min(height, availH - 40)))
  const bounds = mainWindow.getBounds()
  if (bounds.height === clamped) return
  mainWindow.setBounds({ ...bounds, height: clamped })
}

/** Apply a full renderer-driven bounds (custom edge/corner resize or drag). */
function setWindowBounds(bounds: { x: number; y: number; width: number; height: number }): void {
  if (!mainWindow || mainWindow.isDestroyed()) return
  const area = screen.getPrimaryDisplay().workAreaSize
  mainWindow.setBounds({
    x: Math.round(bounds.x),
    y: Math.round(bounds.y),
    width: Math.round(Math.max(MIN_WIDTH, Math.min(bounds.width, area.width))),
    height: Math.round(Math.max(MIN_HEIGHT, Math.min(bounds.height, area.height)))
  })
  schedulePersistBounds()
}

/** True when enough of the window still intersects some display work area. */
function isBoundsVisible(bounds: WindowBounds): boolean {
  return screen.getAllDisplays().some((display) => {
    const area = display.workArea
    const overlapX = Math.max(
      0,
      Math.min(bounds.x + bounds.width, area.x + area.width) - Math.max(bounds.x, area.x)
    )
    const overlapY = Math.max(
      0,
      Math.min(bounds.y + bounds.height, area.y + area.height) - Math.max(bounds.y, area.y)
    )
    return overlapX >= 80 && overlapY >= 40
  })
}

/**
 * Bottom-right resting spot, just above the taskbar — quiet screen real
 * estate that's ideal for passive lyrics. Used only before the user has
 * placed the window.
 *
 * The window is `SHADOW_GUTTER` larger than the visible panel on every side,
 * so the gutter is added back to keep the *panel* — not the invisible window
 * edge — `CORNER_MARGIN` from the corner. `workArea` already excludes the
 * taskbar, so no manual allowance is needed for it.
 */
function defaultWindowBounds(): WindowBounds {
  const workArea = screen.getPrimaryDisplay().workArea
  return {
    width: INITIAL_WIDTH,
    height: INITIAL_HEIGHT,
    x: workArea.x + workArea.width - INITIAL_WIDTH + SHADOW_GUTTER - CORNER_MARGIN,
    y: workArea.y + workArea.height - INITIAL_HEIGHT + SHADOW_GUTTER - CORNER_MARGIN
  }
}

/** Restore the last placement when still on-screen; otherwise first-launch default. */
function resolveInitialBounds(prefs: Prefs): WindowBounds {
  const saved = prefs.windowBounds
  if (!saved) return defaultWindowBounds()
  const area = screen.getPrimaryDisplay().workAreaSize
  const bounds: WindowBounds = {
    x: Math.round(saved.x),
    y: Math.round(saved.y),
    width: Math.round(Math.max(MIN_WIDTH, Math.min(saved.width, area.width))),
    height: Math.round(Math.max(MIN_HEIGHT, Math.min(saved.height, area.height)))
  }
  return isBoundsVisible(bounds) ? bounds : defaultWindowBounds()
}

let persistBoundsTimer: ReturnType<typeof setTimeout> | null = null

function schedulePersistBounds(): void {
  if (persistBoundsTimer) clearTimeout(persistBoundsTimer)
  persistBoundsTimer = setTimeout(() => {
    persistBoundsTimer = null
    if (!mainWindow || mainWindow.isDestroyed()) return
    const bounds = mainWindow.getBounds()
    savePrefs({
      windowBounds: {
        x: bounds.x,
        y: bounds.y,
        width: bounds.width,
        height: bounds.height
      }
    })
  }, 250)
}

function createWindow(): void {
  const prefs = loadPrefs()
  const { x, y, width, height } = resolveInitialBounds(prefs)
  pointerOverPanel = false

  mainWindow = new BrowserWindow({
    width,
    height,
    x,
    y,
    frame: false,
    transparent: true,
    backgroundColor: '#00000000',
    alwaysOnTop: prefs.pinned,
    resizable: true,
    minWidth: MIN_WIDTH,
    minHeight: MIN_HEIGHT,
    // Keep the overlay in the taskbar/Alt-Tab switcher so it can be
    // reached with the normal app-switching shortcuts.
    skipTaskbar: false,
    show: false,
    autoHideMenuBar: true,
    // Windows/Linux: set window + taskbar icon (dev and unpackaged).
    // macOS uses the .icns from the app bundle instead.
    ...(process.platform !== 'darwin' ? { icon } : {}),
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: true,
      contextIsolation: true,
      nodeIntegration: false
    }
  })
  const win = mainWindow

  win.on('ready-to-show', () => {
    // Start click-through on the transparent gutter so desktop items under
    // the shadow ring stay interactive until the cursor enters the panel.
    applyMouseIgnore()
    win.show()
  })

  // Remember placement after the user drags or resizes so relaunch restores it.
  win.on('moved', schedulePersistBounds)
  win.on('resized', schedulePersistBounds)

  // Hover chrome can stick while the cursor stays over the always-on-top
  // panel after Alt-Tabbing away — drive an explicit focus flag from main.
  win.on('focus', () => sendToRenderer(IPC.WINDOW_FOCUS_CHANGED, true))
  win.on('blur', () => sendToRenderer(IPC.WINDOW_FOCUS_CHANGED, false))

  // Null the reference so poll/lyrics callbacks never touch a destroyed
  // window (a silent crash source once the widget can be closed).
  win.on('closed', () => {
    if (persistBoundsTimer) {
      clearTimeout(persistBoundsTimer)
      persistBoundsTimer = null
    }
    mainWindow = null
  })

  // A transparent, always-on-top overlay can lose its GPU/render process
  // after long sessions on Windows. Recover in place instead of leaving a
  // dead panel on screen.
  win.webContents.on('render-process-gone', (_event, details) => {
    console.error('Renderer process gone:', details.reason)
    if (details.reason !== 'clean-exit' && !win.isDestroyed()) {
      win.reload()
    }
  })

  win.on('unresponsive', () => {
    console.error('Window unresponsive — reloading')
    if (!win.isDestroyed()) win.reload()
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

/** Send to the renderer only when the window is genuinely alive. */
function sendToRenderer(channel: string, payload: unknown): void {
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send(channel, payload)
  }
}

/**
 * Bring the overlay back to the foreground. Because the window skips the
 * taskbar, an unpinned panel can sink behind other apps with no way to
 * click it back — this is the reliable escape hatch (tray + shortcut).
 * We briefly force always-on-top so it pops above the focused app, then
 * restore the user's pin preference so it doesn't stay stuck on top.
 */
function summonWindow(): void {
  if (!mainWindow || mainWindow.isDestroyed()) {
    createWindow()
    return
  }
  const win = mainWindow
  if (win.isMinimized()) win.restore()
  win.show()
  const { pinned } = loadPrefs()
  win.setAlwaysOnTop(true, 'screen-saver')
  win.moveTop()
  win.focus()
  if (process.platform === 'darwin') app.focus({ steal: true })
  if (!pinned) win.setAlwaysOnTop(false)
}

/** System-tray fallback so the panel is always reachable when unpinned. */
function createTray(): void {
  if (tray) return
  const image = nativeImage.createFromPath(icon)
  // `new Tray()` throws on an unloadable image, so never hand it the raw
  // path as a fallback — an empty 1x1 keeps the tray present (and the rest
  // of startup running) even if the icon asset is missing from the build.
  const trayIcon = image.isEmpty()
    ? nativeImage.createEmpty()
    : image.resize({ width: 32, height: 32 })
  tray = new Tray(trayIcon)
  tray.setToolTip('Linea')
  tray.on('click', () => summonWindow())
  const menu = Menu.buildFromTemplate([
    { label: 'Show Linea', click: () => summonWindow() },
    { type: 'separator' },
    { label: 'Quit Linea', click: () => app.quit() }
  ])
  tray.setContextMenu(menu)
}

/**
 * Capture mouse only over the visible panel. The 30px shadow gutter is
 * transparent and must not block clicks on the desktop underneath — unless
 * the user has enabled full click-through, in which case everything passes.
 * `{ forward: true }` keeps hover events flowing while ignoring clicks.
 */
function applyMouseIgnore(): void {
  if (!mainWindow || mainWindow.isDestroyed()) return
  const ignore = clickThrough || !pointerOverPanel
  mainWindow.setIgnoreMouseEvents(ignore, { forward: true })
}

function toggleClickThrough(): void {
  if (!mainWindow || mainWindow.isDestroyed()) return
  clickThrough = nextClickThroughState(clickThrough)
  applyMouseIgnore()
  sendToRenderer(IPC.CLICK_THROUGH_CHANGED, clickThrough)
}

function sendNowPlaying(data: PlayerState | null): void {
  sendToRenderer(IPC.NOW_PLAYING, data)
}

function sendLyrics(result: LyricsResult): void {
  sendToRenderer(IPC.LYRICS_UPDATE, result)
}

function sendPlayerError(reason: PlayerErrorReason, message: string): void {
  sendToRenderer(IPC.PLAYER_ERROR, { reason, message })
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
  const state = generateState()
  const { server, code } = await startLoopbackServer(LOOPBACK_PORT, state)

  const authUrl = buildAuthUrl({
    clientId: SPOTIFY_CLIENT_ID,
    redirectUri: SPOTIFY_REDIRECT_URI,
    codeChallenge: challenge,
    scope: SPOTIFY_SCOPE,
    state
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
  sendLyrics({ lines: [], status: 'none' })
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
  const result = await getLyricsForTrack({
    trackId: state.trackId,
    trackName: state.trackName,
    artistName: state.artistName,
    albumName: state.albumName,
    durationSec: Math.round(state.durationMs / 1000)
  })
  // A lookup can span several providers, so a fast skip could land the
  // previous track's lyrics over the current one. Drop late answers.
  if (lastState?.trackId !== state.trackId) return
  sendLyrics(result)
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
        sendLyrics({ lines: [], status: 'none' })
      }
      schedulePoll()
      return
    }

    state.liked = state.trackId ? (likedCache.get(state.trackId) ?? null) : null
    const trackChanged = player.hasTrackChanged(lastState, state)
    lastState = state
    sendNowPlaying(state)

    if (trackChanged && state.trackId) {
      // Both fetches run in the background — lyrics arriving late must
      // not delay scheduling the next playback poll.
      if (!scopeLimited) void updateLikedState(state.trackId)
      refreshLyrics(state).catch((error) => console.error('Lyrics refresh failed:', error))
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
// IPC input validation — the renderer is the least-trusted process, so
// every value crossing into main is checked before use (malformed
// numbers would corrupt window bounds; unchecked command fields would
// be interpolated into Spotify API URLs).
// ------------------------------------------------------------------
function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value)
}

function isValidBounds(
  value: unknown
): value is { x: number; y: number; width: number; height: number } {
  if (typeof value !== 'object' || value === null) return false
  const b = value as Record<string, unknown>
  return (
    isFiniteNumber(b.x) &&
    isFiniteNumber(b.y) &&
    isFiniteNumber(b.width) &&
    isFiniteNumber(b.height)
  )
}

function isValidPlayerCommand(value: unknown): value is PlayerCommand {
  if (typeof value !== 'object' || value === null) return false
  const cmd = value as Record<string, unknown>
  switch (cmd.type) {
    case 'play':
    case 'pause':
    case 'next':
    case 'previous':
      return true
    case 'seek':
      return isFiniteNumber(cmd.positionMs)
    case 'shuffle':
      return typeof cmd.state === 'boolean'
    case 'repeat':
      return cmd.mode === 'off' || cmd.mode === 'context' || cmd.mode === 'track'
    default:
      return false
  }
}

// ------------------------------------------------------------------
// App lifecycle
// ------------------------------------------------------------------
// A long-lived background overlay must not die on a stray async error
// (e.g. a Spotify fetch rejecting during sleep/resume). Log and survive.
process.on('uncaughtException', (error) => {
  console.error('Uncaught exception in main:', error)
})
process.on('unhandledRejection', (reason) => {
  console.error('Unhandled rejection in main:', reason)
})

// The renderer never needs to navigate away from the bundled page (the
// dev server in dev). Block everything else so a hijacked link can't
// load remote content inside the privileged window.
app.on('web-contents-created', (_event, contents) => {
  contents.on('will-navigate', (event, url) => {
    const devUrl = process.env['ELECTRON_RENDERER_URL']
    if (!(is.dev && devUrl && url.startsWith(devUrl))) event.preventDefault()
  })
})

// quitAndInstall() hands control to the NSIS installer, which relaunches the
// app — if the old process is still shutting down, that leaves two overlays
// stacked on the desktop. The lock also fixes the pre-existing case of a user
// launching Linea again when the unpinned panel is buried: the second launch
// now summons the first instead of spawning a duplicate.
const hasInstanceLock = app.requestSingleInstanceLock()
if (!hasInstanceLock) app.quit()

app.on('second-instance', () => summonWindow())

app.whenReady().then(() => {
  if (!hasInstanceLock) return
  electronApp.setAppUserModelId('com.meet2304.linea')

  // The overlay has no use for camera/mic/geolocation/etc. — deny all
  // permission requests outright.
  session.defaultSession.setPermissionRequestHandler((_wc, _permission, callback) =>
    callback(false)
  )

  app.on('browser-window-created', (_, window) => {
    optimizer.watchWindowShortcuts(window)
  })

  ipcMain.handle(IPC.TOGGLE_CLICK_THROUGH, () => {
    toggleClickThrough()
    return clickThrough
  })

  ipcMain.handle(IPC.GET_CLICK_THROUGH_STATE, () => clickThrough)

  ipcMain.handle(IPC.SET_POINTER_OVER_PANEL, (_event, over: unknown) => {
    pointerOverPanel = over === true
    applyMouseIgnore()
  })

  ipcMain.handle(IPC.SPOTIFY_LOGIN, () => loginToSpotify())
  ipcMain.handle(IPC.SPOTIFY_LOGOUT, () => {
    logoutFromSpotify()
  })
  ipcMain.handle(IPC.SPOTIFY_AUTH_STATE, () => hasAuth())

  ipcMain.handle(IPC.PLAYER_COMMAND, (_event, cmd: unknown): Promise<ApiResult<null>> => {
    if (!isValidPlayerCommand(cmd)) return Promise.resolve({ ok: false, reason: 'network' })
    return handlePlayerCommand(cmd)
  })
  ipcMain.handle(IPC.TOGGLE_LIKE, () => handleToggleLike())

  ipcMain.handle(IPC.SET_PINNED, (_event, pinned: unknown) => {
    const value = pinned === true
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.setAlwaysOnTop(value, 'screen-saver')
    }
    savePrefs({ pinned: value })
  })

  ipcMain.handle(IPC.CLOSE_WINDOW, () => {
    if (mainWindow && !mainWindow.isDestroyed()) mainWindow.close()
  })

  ipcMain.handle(IPC.RESIZE_WINDOW, (_event, height: unknown) => {
    if (isFiniteNumber(height)) resizeWindowTo(height)
  })

  ipcMain.handle(IPC.GET_WINDOW_BOUNDS, () => {
    if (!mainWindow || mainWindow.isDestroyed()) {
      return { x: 0, y: 0, width: INITIAL_WIDTH, height: INITIAL_HEIGHT }
    }
    return mainWindow.getBounds()
  })

  ipcMain.handle(IPC.SET_WINDOW_BOUNDS, (_event, bounds: unknown) => {
    if (isValidBounds(bounds)) setWindowBounds(bounds)
  })

  ipcMain.handle(IPC.GET_PREFS, () => loadPrefs())
  ipcMain.handle(IPC.SET_PREFS, (_event, partial: unknown) =>
    savePrefs(typeof partial === 'object' && partial !== null ? (partial as Partial<Prefs>) : {})
  )

  ipcMain.handle(IPC.GET_UPDATE_STATE, () => getUpdateState())
  ipcMain.handle(IPC.CHECK_FOR_UPDATE, () => {
    checkForUpdate()
  })
  ipcMain.handle(IPC.INSTALL_UPDATE, () => {
    installUpdate()
  })

  // Everything the renderer needs is registered above, before the window
  // exists. The renderer's first paint waits on GET_PREFS/AUTH_STATE — if a
  // later step here throws, an unhandled rejection would skip the remaining
  // registrations and leave the panel blank forever, so those handlers must
  // never sit downstream of fallible setup.
  createWindow()
  // The tray and updater are conveniences; neither is worth taking the
  // overlay down for.
  try {
    createTray()
  } catch (error) {
    console.error('Tray creation failed — continuing without it:', error)
  }
  startPolling()
  try {
    initAutoUpdater(sendToRenderer)
  } catch (error) {
    console.error('Auto-updater init failed:', error)
  }

  // Some environments throw while parsing the accelerator rather than
  // returning false — never let that abort the rest of startup.
  try {
    const registered = globalShortcut.register('CommandOrControl+Shift+.', toggleClickThrough)
    if (!registered) {
      console.error('Global shortcut registration failed — another app may own Ctrl+Shift+.')
    }
  } catch (error) {
    console.error('Global shortcut registration threw:', error)
  }

  // Summon the panel back to the foreground (works even when unpinned and
  // buried behind other windows — the main reason it could feel "lost").
  try {
    const registered = globalShortcut.register('CommandOrControl+Shift+L', summonWindow)
    if (!registered) {
      console.error('Summon shortcut registration failed — another app may own Ctrl+Shift+L')
    }
  } catch (error) {
    console.error('Summon shortcut registration threw:', error)
  }

  app.on('activate', function () {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('will-quit', () => {
  globalShortcut.unregisterAll()
  stopPolling()
  stopUpdateChecks()
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})
