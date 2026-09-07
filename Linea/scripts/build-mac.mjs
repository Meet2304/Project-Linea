import { spawnSync } from 'node:child_process'
import { mkdirSync, copyFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
const root = fileURLToPath(new URL('../', import.meta.url))
if (process.platform === 'darwin') {
  mkdirSync(root + 'resources/mac', { recursive: true })
  const result = spawnSync(
    '/usr/bin/xcrun',
    [
      'clang',
      '-fobjc-arc',
      '-fblocks',
      '-arch',
      'arm64',
      '-arch',
      'x86_64',
      '-mmacosx-version-min=12.0',
      '-O2',
      '-framework',
      'Cocoa',
      '-framework',
      'OSAKit',
      '-framework',
      'ApplicationServices',
      root + 'native/mac/main.m',
      '-o',
      root + 'resources/mac/linea-media'
    ],
    { stdio: 'inherit' }
  )
  if (result.error) throw result.error
  if (result.status !== 0) process.exit(result.status ?? 1)
  copyFileSync(root + 'native/mac/media.js', root + 'resources/mac/media.js')
}
