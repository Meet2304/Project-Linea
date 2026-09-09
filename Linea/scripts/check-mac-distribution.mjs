// Public Mac distribution gate. Intentionally fails for unsigned test builds.
import { spawnSync } from 'node:child_process'
import { resolve } from 'node:path'
import { pathToFileURL } from 'node:url'

export function checkMacDistribution(app, run = spawnSync) {
  let passed = true
  for (const [tool, args] of [
    ['/usr/bin/codesign', ['--verify', '--deep', '--strict', '--verbose=2', app]],
    ['/usr/sbin/spctl', ['--assess', '--type', 'execute', '--verbose=4', app]],
    ['/usr/bin/xcrun', ['stapler', 'validate', app]]
  ]) {
    console.log('Mac distribution check:', tool, args.join(' '))
    const result = run(tool, args, { stdio: 'inherit' })
    if (result.error) console.error(result.error.message)
    if (result.error || result.status !== 0) passed = false
  }
  return passed
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  if (process.platform !== 'darwin') throw new Error('Run this check on macOS')
  if (!checkMacDistribution(resolve(process.argv[2] ?? 'dist/mac-universal/Linea.app'))) {
    console.error(
      'Mac public distribution blocked: signing, Gatekeeper assessment or stapled notarization failed.'
    )
    process.exitCode = 1
  }
}
