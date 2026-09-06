import { spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
if (process.platform === 'win32') {
  const result = spawnSync(
    'powershell.exe',
    [
      '-NoProfile',
      '-NonInteractive',
      '-ExecutionPolicy',
      'Bypass',
      '-File',
      fileURLToPath(new URL('./build-smtc.ps1', import.meta.url))
    ],
    { stdio: 'inherit', windowsHide: true }
  )
  if (result.error) throw result.error
  process.exit(result.status ?? 1)
}
