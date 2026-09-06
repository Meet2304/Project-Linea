import { _electron as electron, expect } from '@playwright/test'
import { mkdtempSync, mkdirSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
const profile = mkdtempSync(join(tmpdir(), 'linea-live-'))
const app = await electron.launch({
  args: [join(process.cwd(), 'out/main/index.js')],
  env: { ...process.env, LINEA_TEST_USER_DATA: profile }
})
try {
  const page = await app.firstWindow()
  const errors = []
  page.on('pageerror', (e) => errors.push(e.message))
  await expect
    .poll(
      () => page.evaluate(async () => (await window.linea.getPlaybackSnapshot()).sourceStatus),
      { timeout: 10000 }
    )
    .toBe('ready')
  const first = await page.evaluate(() => window.linea.getPlaybackSnapshot())
  console.log(
    JSON.stringify({
      pid: app.process().pid,
      profile,
      source: first.sourceStatus,
      track: first.player.trackName,
      capabilities: first.player.capabilities,
      position: first.player.progressMs,
      duration: first.player.durationMs
    })
  )
  await expect
    .poll(
      () => page.evaluate(async () => (await window.linea.getPlaybackSnapshot()).lyrics.status),
      { timeout: 18000 }
    )
    .not.toBe('none')
    .catch(() => {})
  const second = await page.evaluate(() => window.linea.getPlaybackSnapshot())
  console.log(
    JSON.stringify({
      source: second.sourceStatus,
      track: second.player?.trackName,
      lyricsStatus: second.lyrics.status,
      lyricLines: second.lyrics.lines.length,
      revision: second.revision,
      errors
    })
  )
  mkdirSync('output/playwright', { recursive: true })
  await page.evaluate(() => (document.getElementById('app').dataset.pointerInside = 'true'))
  await page.screenshot({ path: 'output/playwright/live-media.png' })
  if (errors.length || !second.player?.timelineValid)
    throw new Error('Live UI or timeline check failed')
  // Leave a bounded observation window for resource and stability checks.
  await new Promise((r) => setTimeout(r, 20000))
  const final = await page.evaluate(() => window.linea.getPlaybackSnapshot())
  console.log(
    JSON.stringify({
      finalSource: final.sourceStatus,
      finalSession: final.player?.sessionId,
      finalTrack: final.player?.trackName
    })
  )
} finally {
  await app.close()
}
