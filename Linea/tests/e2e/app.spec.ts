import { test, expect, _electron as electron } from '@playwright/test'
import type { ElectronApplication, Page } from '@playwright/test'
import { join } from 'node:path'
import { mkdtempSync, mkdirSync } from 'node:fs'
import { tmpdir } from 'node:os'
const rendererErrors: string[] = []

let app: ElectronApplication
let page: Page

test.describe.configure({ mode: 'serial' })

test.beforeAll(async () => {
  app = await electron.launch({
    args: [join(process.cwd(), 'out/main/index.js')],
    env: {
      ...process.env,
      LINEA_TEST_NO_MEDIA: '1',
      LINEA_TEST_USER_DATA: mkdtempSync(join(tmpdir(), 'linea-e2e-'))
    }
  })
  mkdirSync('output/playwright', { recursive: true })
  page = await app.firstWindow()
  page.on('pageerror', (error) => rendererErrors.push(error.message))
  await page.waitForLoadState('domcontentloaded')
})

test.afterAll(async () => {
  await app.close()
})

test('window is frameless', async () => {
  // Frameless windows have matching outer and content bounds (no title-bar chrome)
  const isFrameless = await app.evaluate(({ BrowserWindow }) => {
    const win = BrowserWindow.getAllWindows()[0]
    if (!win) throw new Error('No BrowserWindow open')
    const bounds = win.getBounds()
    const content = win.getContentBounds()
    return bounds.width === content.width && bounds.height === content.height
  })
  expect(isFrameless).toBe(true)
})

test('window opens at panel size', async () => {
  const bounds = await app.evaluate(({ BrowserWindow }) => {
    const win = BrowserWindow.getAllWindows()[0]
    if (!win) throw new Error('No BrowserWindow open')
    return win.getBounds()
  })
  // 600 wide (landscape) by default; freely resizable. DPI scaling can
  // nudge getBounds() by a few pixels.
  expect(bounds.width).toBeGreaterThanOrEqual(580)
  expect(bounds.width).toBeLessThanOrEqual(620)
  expect(bounds.height).toBeGreaterThanOrEqual(100)
  expect(bounds.height).toBeLessThanOrEqual(700)
})

/**
 * Transparent shadow ring around the panel. Mirrors src/main/index.ts, where
 * the matching CORNER_MARGIN is 16.
 */
const SHADOW_GUTTER = 30

test('window opens bottom-right when no saved placement exists', async () => {
  // Fresh launches have null windowBounds. Bottom-right, just above the
  // taskbar, is the first-run default — it replaced bottom-center in 0.1.1.
  // After the user moves the window, that placement is restored instead.
  const { bounds, workArea } = await app.evaluate(({ BrowserWindow, screen }) => {
    const win = BrowserWindow.getAllWindows()[0]
    if (!win) throw new Error('No BrowserWindow open')
    return { bounds: win.getBounds(), workArea: screen.getPrimaryDisplay().workArea }
  })

  // The window is SHADOW_GUTTER larger than the visible panel on every side,
  // so asserting the window's own edges would bake the gutter into the
  // expectation. What 0.1.1 promised is about the *panel*: its visible corner
  // sits near the work-area corner.
  const panelRight = bounds.x + bounds.width - SHADOW_GUTTER
  const panelBottom = bounds.y + bounds.height - SHADOW_GUTTER

  const gapRight = workArea.x + workArea.width - panelRight
  const gapBottom = workArea.y + workArea.height - panelBottom

  // How close depends on the platform, and both answers are correct.
  //
  // Placing the panel 16px from the corner means the window itself — gutter
  // included — hangs 14px past the work area. Windows and Linux allow that,
  // so the panel lands exactly on 16. macOS refuses to position a window
  // outside the visible frame and clamps it back, which pushes the whole
  // gutter inside and leaves the panel SHADOW_GUTTER from the corner.
  //
  // So assert the range rather than one platform's number: the panel is on
  // screen, and no further in than a full gutter. DPI scaling can nudge
  // getBounds() by a few pixels on top of that.
  expect(gapRight).toBeGreaterThanOrEqual(0)
  expect(gapRight).toBeLessThanOrEqual(SHADOW_GUTTER + 12)
  expect(gapBottom).toBeGreaterThanOrEqual(0)
  expect(gapBottom).toBeLessThanOrEqual(SHADOW_GUTTER + 12)

  // And prove it is anchored rather than centred — the stale version of this
  // test asserted bottom-*center*, which is what the app did before 0.1.1.
  // A centred window would leave equal room on both sides.
  expect(gapRight).toBeLessThan(bounds.x - workArea.x)
  expect(gapBottom).toBeLessThan(bounds.y - workArea.y)
})

test('renderer exposes window.linea but not window.require', async () => {
  const lineaApi = await page.evaluate(() => typeof window.linea)
  const requireApi = await page.evaluate(
    () => typeof (window as unknown as { require?: unknown }).require
  )
  expect(lineaApi).toBe('object')
  expect(requireApi).toBe('undefined')
})

test('opens directly into the player with no Spotify login', async () => {
  await expect(page.locator('#player-view')).toBeVisible()
  await expect(page.locator('#connect-view')).toHaveCount(0)
  expect(await page.evaluate(() => 'login' in window.linea)).toBe(false)
})

test('click-through state changes via IPC', async () => {
  const stateBefore = await page.evaluate(async () => window.linea.getClickThroughState())
  await page.evaluate(async () => window.linea.toggleClickThrough())
  const stateAfter = await page.evaluate(async () => window.linea.getClickThroughState())
  expect(stateAfter).not.toBe(stateBefore)
  // restore
  await page.evaluate(async () => window.linea.toggleClickThrough())
})

test('click-through toggles broadcast to the renderer (desync regression)', async () => {
  // Toggling from ANY path (IPC, global shortcut) must push
  // CLICK_THROUGH_CHANGED so UI switches never desync.
  const received = await page.evaluate(
    async () =>
      await new Promise<boolean>((resolve) => {
        const timeout = setTimeout(() => resolve(false), 2000)
        const unsubscribe = window.linea.onClickThroughChanged(() => {
          clearTimeout(timeout)
          unsubscribe()
          resolve(true)
        })
        void window.linea.toggleClickThrough()
      })
  )
  expect(received).toBe(true)
  await page.evaluate(async () => window.linea.toggleClickThrough())
})

test('theme pref persists through the prefs IPC round trip', async () => {
  const original = await page.evaluate(async () => (await window.linea.getPrefs()).theme)
  const flipped = original === 'dark' ? 'light' : 'dark'

  await page.evaluate(async (theme) => {
    await window.linea.setPrefs({ theme: theme as 'light' | 'dark' })
  }, flipped)
  const persisted = await page.evaluate(async () => (await window.linea.getPrefs()).theme)
  expect(persisted).toBe(flipped)

  // restore
  await page.evaluate(async (theme) => {
    await window.linea.setPrefs({ theme: theme as 'light' | 'dark' })
  }, original)
})

test('resizeTo drives the window height (renderer-measured auto-size)', async () => {
  const heightOf = (): Promise<number> =>
    app.evaluate(({ BrowserWindow }) => {
      const win = BrowserWindow.getAllWindows()[0]
      if (!win) throw new Error('No BrowserWindow open')
      return win.getBounds().height
    })

  const before = await heightOf()
  await page.evaluate(async () => window.linea.resizeTo(360))
  const grown = await heightOf()
  expect(grown).not.toBe(before)
  // Height tracks the requested value (allowing DPI-scaling drift).
  expect(Math.abs(grown - 360)).toBeLessThanOrEqual(10)

  // restore
  await page.evaluate(async (original) => window.linea.resizeTo(original), before)
})

test('pin toggle updates always-on-top', async () => {
  const pinned = await page.evaluate(async () => (await window.linea.getPrefs()).pinned)

  await page.evaluate(async (next) => {
    await window.linea.setPinned(next)
  }, !pinned)
  const onTop = await app.evaluate(({ BrowserWindow }) => {
    const win = BrowserWindow.getAllWindows()[0]
    if (!win) throw new Error('No BrowserWindow open')
    return win.isAlwaysOnTop()
  })
  expect(onTop).toBe(!pinned)

  // restore
  await page.evaluate(async (original) => {
    await window.linea.setPinned(original)
  }, pinned)
})

test('capabilities and timing survive bootstrap and renderer reload', async () => {
  const { SessionMapper } = await import('../../src/main/smtcState')
  const { media } = await import('../fixtures/media')
  const player = new SessionMapper().map(
    media({
      timeline: {
        startMs: 0,
        endMs: 180000,
        positionMs: 10000,
        updatedAt: Date.now(),
        minSeekMs: 0,
        maxSeekMs: 180000
      }
    })
  )
  const snapshot = {
    revision: 100,
    player,
    lyrics: {
      status: 'ok' as const,
      lines: [
        { timeMs: 0, text: 'Original test lyrics' },
        { timeMs: 30000, text: 'Another original line' }
      ]
    },
    sourceStatus: 'ready' as const
  }
  await app.evaluate(({ ipcMain }, value) => {
    ipcMain.removeHandler('linea:get-playback-snapshot')
    ipcMain.handle('linea:get-playback-snapshot', () => value)
  }, snapshot)
  await page.reload()
  await expect(page.locator('#track-title')).toHaveText('Original Song')
  await expect(page.locator('#btn-play')).toBeEnabled()
  await page.evaluate(() => (document.getElementById('app')!.dataset.pointerInside = 'true'))
  await expect(page.locator('#btn-shuffle')).not.toHaveAttribute('hidden')
  await expect(page.locator('#seek')).toBeEnabled()
  await expect(page.locator('.lyric-row')).toHaveCount(2)

  const unavailable = {
    ...snapshot,
    revision: 101,
    player: {
      ...player,
      timelineValid: false,
      capabilities: {
        ...player.capabilities,
        play: false,
        pause: false,
        seek: false,
        shuffle: false,
        repeat: false
      }
    }
  }
  await app.evaluate(
    ({ BrowserWindow }, value) =>
      BrowserWindow.getAllWindows()[0].webContents.send('linea:now-playing', value),
    unavailable
  )
  await expect(page.locator('#btn-play')).toBeDisabled()
  await expect(page.locator('#seek')).toBeDisabled()
  await expect(page.locator('#btn-shuffle')).toHaveAttribute('hidden')
  await expect(page.locator('#btn-repeat')).toHaveAttribute('hidden')
  await expect(page.locator('#time-elapsed')).toHaveText('--:--')
  await expect(page.locator('.lyric-row[data-pos="active"]')).toHaveCount(0)

  // A delayed older event cannot replace the current source state.
  await app.evaluate(
    ({ BrowserWindow }, value) =>
      BrowserWindow.getAllWindows()[0].webContents.send('linea:now-playing', value),
    snapshot
  )
  await expect(page.locator('#seek')).toBeDisabled()
  await page.screenshot({ path: 'output/playwright/timing-unavailable.png' })
})

test('media failure and idle keep settings and close reachable', async () => {
  for (const [revision, status, copy] of [
    [102, 'unavailable', 'Media access unavailable'],
    [103, 'idle', 'Play a song']
  ] as const) {
    await app.evaluate(
      ({ BrowserWindow }, value) =>
        BrowserWindow.getAllWindows()[0].webContents.send('linea:now-playing', value),
      { revision, player: null, lyrics: { lines: [], status: 'none' }, sourceStatus: status }
    )
    await expect(page.locator('#track-artist')).toContainText(copy)
    await expect(page.locator('#player-view')).toBeVisible()
    await expect(page.locator('#btn-play')).toBeDisabled()
    await expect(page.locator('#btn-close')).toBeAttached()
    await expect(page.locator('#btn-settings')).toBeAttached()
  }
})

test('rejected commands restore actual playback without changing a replacement track', async () => {
  const { SessionMapper } = await import('../../src/main/smtcState')
  const { media } = await import('../fixtures/media')
  const player = new SessionMapper().map(
    media({
      timeline: {
        startMs: 0,
        endMs: 180000,
        positionMs: 10000,
        updatedAt: Date.now(),
        minSeekMs: 0,
        maxSeekMs: 180000
      }
    })
  )
  const snapshot = {
    revision: 104,
    player,
    lyrics: { lines: [], status: 'none' as const },
    sourceStatus: 'ready' as const
  }
  await app.evaluate(({ ipcMain, BrowserWindow }, value) => {
    ipcMain.removeHandler('linea:player-command')
    ipcMain.handle('linea:player-command', () => ({ ok: false, reason: 'command_rejected' }))
    BrowserWindow.getAllWindows()[0].webContents.send('linea:now-playing', value)
  }, snapshot)
  await page.locator('#app').hover()
  await page.locator('#btn-play').click()
  await expect(page.locator('#toast')).toContainText('could not perform')
  await expect(page.locator('#btn-play')).toHaveAttribute('aria-label', 'Pause')
  await app.evaluate(
    ({ ipcMain, BrowserWindow }, value) => {
      ipcMain.removeHandler('linea:player-command')
      ipcMain.handle('linea:player-command', async () => {
        BrowserWindow.getAllWindows()[0].webContents.send('linea:now-playing', value)
        await new Promise((resolve) => setTimeout(resolve, 100))
        return { ok: false, reason: 'session_unavailable' }
      })
    },
    {
      ...snapshot,
      revision: 105,
      player: {
        ...player,
        trackId: 'replacement',
        trackName: 'Replacement track',
        isPlaying: false
      }
    }
  )
  await page.locator('#btn-play').click()
  await expect(page.locator('#track-title')).toHaveText('Replacement track')
  await expect(page.locator('#toast')).toContainText('song or player changed')
  await expect(page.locator('#btn-play')).toHaveAttribute('aria-label', 'Play')
})

test('renderer reports no unhandled script errors', () => {
  expect(rendererErrors).toEqual([])
})
