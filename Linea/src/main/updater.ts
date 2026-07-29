import { app, shell } from 'electron'
import { autoUpdater } from 'electron-updater'
import { is } from '@electron-toolkit/utils'
import { IPC } from '../shared/ipcChannels'
import type { UpdateState } from '../shared/types'

/** Where macOS users are sent, since they cannot be updated in place. */
const RELEASES_URL = 'https://github.com/Meet2304/Project-Linea/releases/latest'

/**
 * Linea is a tray-resident overlay people leave running for days. A single
 * check at launch would mean a user who never restarts never learns about a
 * release, so re-check on a slow interval too.
 */
const RECHECK_INTERVAL_MS = 6 * 60 * 60 * 1000

/**
 * Only Windows can install in place. The mac build is dmg-only and unsigned,
 * and electron-updater's MacUpdater requires a signed app plus a zip target —
 * downloading there would fail at the signature check, so we never start one.
 */
const canSelfUpdate = process.platform === 'win32'

let state: UpdateState = { status: 'idle', version: app.getVersion() }
let send: (channel: string, payload: unknown) => void = () => {}
let recheckTimer: ReturnType<typeof setInterval> | null = null

function setState(next: UpdateState): void {
  state = next
  send(IPC.UPDATE_STATE, state)
}

/** Safe before initAutoUpdater() has run — the renderer may ask first. */
export function getUpdateState(): UpdateState {
  return state
}

export function initAutoUpdater(sendToRenderer: (channel: string, payload: unknown) => void): void {
  send = sendToRenderer

  // The updater has no feed in dev. LINEA_DEV_UPDATER=1 opts in via
  // dev-app-update.yml, which is the only way to exercise this end to end
  // without cutting a real release.
  const devOptIn = process.env['LINEA_DEV_UPDATER'] === '1'
  if (is.dev) {
    if (!devOptIn) return
    autoUpdater.forceDevUpdateConfig = true
  }

  autoUpdater.autoDownload = canSelfUpdate
  autoUpdater.autoInstallOnAppQuit = canSelfUpdate

  autoUpdater.on('checking-for-update', () => {
    setState({ status: 'checking', version: app.getVersion() })
  })

  autoUpdater.on('update-available', (info) => {
    setState(
      canSelfUpdate
        ? { status: 'downloading', version: app.getVersion(), next: info.version, percent: 0 }
        : { status: 'manual', version: app.getVersion(), next: info.version }
    )
  })

  autoUpdater.on('update-not-available', () => {
    setState({ status: 'idle', version: app.getVersion() })
  })

  autoUpdater.on('download-progress', (progress) => {
    // Only meaningful while downloading; a late event after 'ready' must not
    // knock the badge back off.
    if (state.status !== 'downloading') return
    setState({ ...state, percent: Math.round(progress.percent) })
  })

  autoUpdater.on('update-downloaded', (info) => {
    setState({ status: 'ready', version: app.getVersion(), next: info.version })
  })

  autoUpdater.on('error', (error) => {
    console.error('Auto-updater error:', error)
    // A failed re-check must not erase an update the user has already been
    // told about — only report the error when nothing is pending.
    if (state.status === 'ready' || state.status === 'manual') return
    setState({ status: 'error', version: app.getVersion() })
  })

  checkForUpdate()
  recheckTimer = setInterval(checkForUpdate, RECHECK_INTERVAL_MS)
}

export function checkForUpdate(): void {
  // Nothing to re-check once an update is in hand, and a check would restart
  // a download that is already finished.
  if (state.status === 'checking' || state.status === 'downloading') return
  if (state.status === 'ready' || state.status === 'manual') return
  // checkForUpdates(), not checkForUpdatesAndNotify() — the "AndNotify"
  // variant raises a native OS notification, which duplicates the in-app one.
  void autoUpdater.checkForUpdates()?.catch((error) => {
    console.error('Update check failed:', error)
  })
}

/** Windows installs and relaunches; macOS opens the release page. */
export function installUpdate(): void {
  if (state.status === 'manual') {
    void shell.openExternal(RELEASES_URL)
    return
  }
  if (state.status !== 'ready') return
  // isSilent=false so the NSIS installer's progress is visible; isForceRunAfter
  // so the overlay comes back on its own.
  autoUpdater.quitAndInstall(false, true)
}

export function stopUpdateChecks(): void {
  if (recheckTimer) {
    clearInterval(recheckTimer)
    recheckTimer = null
  }
}
