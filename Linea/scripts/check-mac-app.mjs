import { _electron as electron, expect } from '@playwright/test'
import { resolve } from 'node:path'
import { readFileSync } from 'node:fs'
const metadata = JSON.parse(readFileSync('package.json', 'utf8'))
const app = await electron.launch({
  executablePath: resolve('dist/mac-universal/Linea.app/Contents/MacOS/Linea')
})
try {
  const page = await app.firstWindow()
  await expect
    .poll(
      () => page.evaluate(() => window.linea.getPlaybackSnapshot().then((s) => s.sourceStatus)),
      { timeout: 10000 }
    )
    .toBe('idle')
  await expect(page.locator('#track-title')).toHaveText('Nothing playing')
  if ((await app.evaluate(({ app }) => app.getVersion())) !== metadata.version)
    throw new Error('Wrong packaged app version')
  if ((await page.evaluate(() => window.linea.platform)) !== 'darwin')
    throw new Error('Wrong platform')
  console.log('Packaged universal Mac app launches and initializes the bundled media helper.')
} finally {
  await app.close()
}
