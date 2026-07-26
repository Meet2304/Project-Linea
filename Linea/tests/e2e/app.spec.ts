import { test, expect, _electron as electron } from '@playwright/test'
import type { ElectronApplication, Page } from '@playwright/test'
import { join } from 'node:path'

let app: ElectronApplication
let page: Page

test.describe.configure({ mode: 'serial' })

test.beforeAll(async () => {
  app = await electron.launch({
    args: [join(process.cwd(), 'out/main/index.js')]
  })
  page = await app.firstWindow()
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

test('shows either the connect view or the player view', async () => {
  const connectVisible = await page.locator('#connect-view').isVisible()
  const playerVisible = await page.locator('#player-view').isVisible()
  expect(connectVisible || playerVisible).toBe(true)
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
