import { readFileSync } from 'node:fs'
import { spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'

const metadata = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'))
const channel = /-beta\.\d+$/.test(metadata.version) ? 'beta' : 'latest'
// GitHub publishing does not infer the manifest channel from the app version.
const cli = fileURLToPath(
  new URL('../node_modules/electron-builder/out/cli/cli.js', import.meta.url)
)
const result = spawnSync(
  process.execPath,
  [cli, ...process.argv.slice(2), '--config.publish.channel=' + channel],
  { stdio: 'inherit', windowsHide: true }
)
if (result.error) throw result.error
process.exit(result.status ?? 1)
