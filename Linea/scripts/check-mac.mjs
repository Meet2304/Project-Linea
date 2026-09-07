import { spawn } from 'node:child_process'
import { createInterface } from 'node:readline'
import { resolve } from 'node:path'
if (process.platform !== 'darwin') throw new Error('Run this check on macOS')
const child = spawn(resolve('resources/mac/linea-media'), [], {
  stdio: ['pipe', 'pipe', 'inherit']
})
const timer = setTimeout(() => {
  child.kill()
  process.exitCode = 1
}, 5000)
let snapshot = false,
  invalid = false
createInterface({ input: child.stdout }).on('line', (line) => {
  const value = JSON.parse(line)
  if (value.v !== 1) throw new Error('Unexpected protocol version')
  if (value.type === 'response' && value.id === 1)
    snapshot = value.ok || value.reason === 'permission_required'
  if (value.type === 'response' && value.id === 2)
    invalid = !value.ok && value.reason === 'invalid_request'
})
child.on('error', (error) => {
  clearTimeout(timer)
  throw error
})
child.on('exit', (code) => {
  clearTimeout(timer)
  if (code !== 0 || !snapshot || !invalid) process.exitCode = 1
  else console.log('Mac helper starts, executes JXA, responds, and exits on pipe closure.')
})
child.stdin.end(
  JSON.stringify({ v: 1, id: 1, method: 'snapshot' }) +
    '\n' +
    JSON.stringify({ v: 1, id: 2, method: 'invalid' }) +
    '\n'
)
