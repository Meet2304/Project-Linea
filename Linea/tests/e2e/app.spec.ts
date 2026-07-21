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

test('window is always on top', async () => {
  const isAlwaysOnTop = await app.evaluate(({ BrowserWindow }) => {
    const win = BrowserWindow.getAllWindows()[0]
    if (!win) throw new Error('No BrowserWindow open')
    return win.isAlwaysOnTop()
  })
  expect(isAlwaysOnTop).toBe(true)
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

test('window opens with the correct initial size', async () => {
  const bounds = await app.evaluate(({ BrowserWindow }) => {
    const win = BrowserWindow.getAllWindows()[0]
    if (!win) throw new Error('No BrowserWindow open')
    return win.getBounds()
  })
  // Windows DPI scaling can nudge getBounds() by a few pixels
  expect(bounds.width).toBeGreaterThanOrEqual(380)
  expect(bounds.width).toBeLessThanOrEqual(400)
  expect(bounds.height).toBeGreaterThanOrEqual(240)
  expect(bounds.height).toBeLessThanOrEqual(260)
})

test('renderer exposes window.linea but not window.require', async () => {
  const lineaApi = await page.evaluate(() => typeof window.linea)
  const requireApi = await page.evaluate(
    () => typeof (window as unknown as { require?: unknown }).require
  )
  expect(lineaApi).toBe('object')
  expect(requireApi).toBe('undefined')
})

test('click-through toggle button exists and can be clicked', async () => {
  const button = page.locator('#click-through-btn')
  await expect(button).toBeVisible()
  await button.click()
  const text = await button.textContent()
  expect(text).toMatch(/click-through/i)
})

test('click-through state changes via IPC', async () => {
  const stateBefore = await page.evaluate(async () => window.linea.getClickThroughState())

  await page.locator('#click-through-btn').click()

  const stateAfter = await page.evaluate(async () => window.linea.getClickThroughState())
  expect(stateAfter).not.toBe(stateBefore)
})
