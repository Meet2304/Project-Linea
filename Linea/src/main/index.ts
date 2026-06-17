import { app, shell, BrowserWindow, globalShortcut, screen, ipcMain } from 'electron'
import { join } from 'path'
import { electronApp, optimizer, is } from '@electron-toolkit/utils'
import icon from '../../resources/icon.png?asset'
import { IPC } from '../shared/ipcChannels'
import { nextClickThroughState } from './clickThrough'

let mainWindow: BrowserWindow | null = null
let clickThrough = false

function createWindow(): void {
  const { width } = screen.getPrimaryDisplay().workAreaSize

  // Create the browser window.
  mainWindow = new BrowserWindow({
    width: 320,
    height: 160,
    x: width - 340,
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
  const win = mainWindow // win is BrowserWindow here

  win.on('ready-to-show', () => {
    win.show()
  })

  win.webContents.setWindowOpenHandler((details) => {
    shell.openExternal(details.url)
    return { action: 'deny' }
  })

  // HMR for renderer base on electron-vite cli.
  // Load the remote URL for development or the local html file for production.
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

// This method will be called when Electron has finished
// initialization and is ready to create browser windows.
// Some APIs can only be used after this event occurs.
app.whenReady().then(() => {
  // Set app user model id for windows
  electronApp.setAppUserModelId('com.electron')

  // Default open or close DevTools by F12 in development
  // and ignore CommandOrControl + R in production.
  // see https://github.com/alex8088/electron-toolkit/tree/master/packages/utils
  app.on('browser-window-created', (_, window) => {
    optimizer.watchWindowShortcuts(window)
  })

  createWindow()

  ipcMain.handle(IPC.TOGGLE_CLICK_THROUGH, () => {
    toggleClickThrough()
    return clickThrough
  })

  ipcMain.handle(IPC.GET_CLICK_THROUGH_STATE, () => clickThrough)

  const registered = globalShortcut.register('CommandOrControl+Shift+Period', toggleClickThrough)
  if (!registered) {
    console.error('Global shortcut registration failed — another app may own Ctrl+Shift+Period')
  }

  app.on('activate', function () {
    // On macOS it's common to re-create a window in the app when the
    // dock icon is clicked and there are no other windows open.
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('will-quit', () => {
  globalShortcut.unregisterAll()
})

// Quit when all windows are closed, except on macOS. There, it's common
// for applications and their menu bar to stay active until the user quits
// explicitly with Cmd + Q.
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})

// In this file you can include the rest of your app's specific main process
// code. You can also put them in separate files and require them here.
