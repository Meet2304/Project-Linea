import { autoUpdater } from 'electron-updater'
import { is } from '@electron-toolkit/utils'

export function initAutoUpdater(): void {
  if (is.dev) return // don't check for updates in dev mode

  autoUpdater.autoDownload = true
  autoUpdater.autoInstallOnAppQuit = true

  autoUpdater.on('checking-for-update', () => {
    console.log('Checking for update…')
  })

  autoUpdater.on('update-available', (info) => {
    console.log(`Update available: ${info.version}`)
  })

  autoUpdater.on('update-not-available', () => {
    console.log('App is up to date')
  })

  autoUpdater.on('update-downloaded', () => {
    console.log('Update downloaded; will install on quit')
  })

  autoUpdater.on('error', (err) => {
    console.error('Auto-updater error:', err)
  })

  void autoUpdater.checkForUpdatesAndNotify()
}
