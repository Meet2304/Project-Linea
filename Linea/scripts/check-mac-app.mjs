import { _electron as electron, expect } from '@playwright/test'
import { resolve, join } from 'node:path'
import { tmpdir } from 'node:os'
import { execFileSync } from 'node:child_process'
import assert from 'node:assert/strict'
import {
  readFileSync,
  existsSync,
  accessSync,
  constants,
  mkdtempSync,
  rmSync
} from 'node:fs'
const fsExistsStable = () => existsSync('dist/latest-mac.yml')
const metadata = JSON.parse(readFileSync('package.json', 'utf8'))
const original = resolve('dist/mac-universal/Linea.app')
for (const relative of ['Contents/MacOS/Linea', 'Contents/Resources/mac/linea-media']) {
  const binary = join(original, relative)
  accessSync(binary, constants.R_OK | constants.X_OK)
  const architectures = execFileSync('/usr/bin/lipo', ['-archs', binary], { encoding: 'utf8' })
    .trim()
    .split(/\s+/)
  assert.ok(
    architectures.includes('arm64') && architectures.includes('x86_64'),
    relative + ' must be universal'
  )
}
accessSync(join(original, 'Contents/Resources/mac/media.js'), constants.R_OK)
const usage = execFileSync(
  '/usr/bin/plutil',
  [
    '-extract',
    'NSAppleEventsUsageDescription',
    'raw',
    '-o',
    '-',
    join(original, 'Contents/Info.plist')
  ],
  { encoding: 'utf8' }
)
assert.ok(usage.trim(), 'Missing Automation usage description')
const copiedDirectory = mkdtempSync(join(tmpdir(), 'Linea installed é '))
let app
try {
  const installed = join(copiedDirectory, 'Linea.app')
  // Preserve macOS bundle symlinks, permissions and extended attributes.
  execFileSync('/usr/bin/ditto', [original, installed])
  app = await electron.launch({ executablePath: join(installed, 'Contents/MacOS/Linea') })
  app.process().stderr.on('data', chunk => process.stderr.write(chunk))
  app.process().on('exit', (code, signal) => console.log('Packaged app exited:', { code, signal }))
  const page = await app.firstWindow()
  page.on('crash', () => console.error('Packaged renderer crashed'))
  // Allow the helper's startup/read deadlines to expose a broken packaged path.
  await new Promise((resolve) => setTimeout(resolve, 6500))
  const manifest = readFileSync('dist/beta-mac.yml', 'utf8')
  if (!manifest.includes('version: ' + metadata.version))
    throw new Error('Missing beta Mac update metadata')
  if (fsExistsStable()) throw new Error('Mac beta produced a stable manifest')
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
  try {
    await app?.close()
  } finally {
    rmSync(copiedDirectory, { recursive: true, force: true })
  }
}
