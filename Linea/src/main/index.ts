import { app, shell, BrowserWindow, globalShortcut, screen, ipcMain } from 'electron'
import { join } from 'path'
import { electronApp, optimizer, is } from '@electron-toolkit/utils'
import icon from '../../resources/icon.png?asset'
import { IPC } from '../shared/ipcChannels'
import type { NowPlaying, Prefs } from '../shared/types'
import type { LyricLine } from '../shared/lyrics'
import { nextClickThroughState } from './clickThrough'
import {
  generateCodeVerifier,
  generateCodeChallenge,
  buildAuthUrl,
  exchangeCodeForTokens,
  refreshAccessToken
} from './spotifyAuth'
import { startLoopbackServer } from './loopbackServer'
import { saveRefreshToken, loadRefreshToken, clearRefreshToken } from './tokenStore'
import { SPOTIFY_CLIENT_ID, SPOTIFY_REDIRECT_URI, SPOTIFY_SCOPE, LOOPBACK_PORT } from './config'
import { fetchCurrentlyPlaying, hasTrackChanged } from './spotifyPlayer'
import { getLyricsForTrack } from './lyricsCache'
import { loadPrefs, savePrefs } from './prefs'
import { initAutoUpdater } from './updater'

let mainWindow: BrowserWindow | null = null
let clickThrough = false
let accessToken: string | null = null
let tokenExpiresAt = 0
let lastNowPlaying: NowPlaying | null = null
let pollTimer: ReturnType<typeof setInterval> | null = null

function createWindow(): void {
  const { width } = screen.getPrimaryDisplay().workAreaSize

  mainWindow = new BrowserWindow({
    width: 380,
    height: 240,
    x: width - 400,
    y: 40,
    frame: false,
    transparent: true,
    backgroundColor: '#00000000',
    alwaysOnTop: true,
    resizable: true,
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
  mainWindow.setIgnoreMouseEvents(clickThrough)
}

function sendNowPlaying(data: NowPlaying | null): void {
  mainWindow?.webContents.send(IPC.NOW_PLAYING, data)
}

function sendLyrics(lines: LyricLine[]): void {
  mainWindow?.webContents.send(IPC.LYRICS_UPDATE, lines)
}

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
    accessToken = tokens.accessToken
    tokenExpiresAt = Date.now() + tokens.expiresIn * 1000
    return true
  } finally {
    server.close()
  }
}

function logoutFromSpotify(): void {
  clearRefreshToken()
  accessToken = null
  tokenExpiresAt = 0
  lastNowPlaying = null
  sendNowPlaying(null)
  sendLyrics([])
}

async function ensureFreshAccessToken(): Promise<string | null> {
  if (accessToken && Date.now() < tokenExpiresAt - 30_000) return accessToken
  if (!SPOTIFY_CLIENT_ID) return null

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

async function pollNowPlaying(): Promise<void> {
  try {
    const token = await ensureFreshAccessToken()
    if (!token || !mainWindow) return

    const nowPlaying = await fetchCurrentlyPlaying(token)
    if (!nowPlaying) {
      if (lastNowPlaying !== null) {
        lastNowPlaying = null
        sendNowPlaying(null)
        sendLyrics([])
      }
      return
    }

    sendNowPlaying(nowPlaying)

    if (hasTrackChanged(lastNowPlaying, nowPlaying) && nowPlaying.trackId) {
      const lines = await getLyricsForTrack({
        trackId: nowPlaying.trackId,
        trackName: nowPlaying.trackName,
        artistName: nowPlaying.artistName,
        albumName: nowPlaying.albumName,
        durationSec: Math.round(nowPlaying.durationMs / 1000)
      })
      sendLyrics(lines)
    }

    lastNowPlaying = nowPlaying
  } catch (error) {
    console.error('Now-playing poll failed:', error)
  }
}

function startPolling(): void {
  if (pollTimer) return
  void pollNowPlaying()
  pollTimer = setInterval(() => {
    void pollNowPlaying()
  }, 2000)
}

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
  ipcMain.handle(IPC.SPOTIFY_AUTH_STATE, () => accessToken !== null || loadRefreshToken() !== null)

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
  if (pollTimer) {
    clearInterval(pollTimer)
    pollTimer = null
  }
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})
