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
  // 480 wide (landscape) by default; freely resizable. DPI scaling can
  // nudge getBounds() by a few pixels.
  expect(bounds.width).toBeGreaterThanOrEqual(460)
  expect(bounds.width).toBeLessThanOrEqual(500)
  expect(bounds.height).toBeGreaterThanOrEqual(100)
  expect(bounds.height).toBeLessThanOrEqual(700)
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
