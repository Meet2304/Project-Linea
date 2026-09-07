import { spawn, spawnSync } from 'node:child_process'
import { mkdtempSync, copyFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import assert from 'node:assert/strict'

if (process.platform !== 'darwin') throw new Error('Run on macOS')
const dir = mkdtempSync(join(tmpdir(), 'linea permission é '))
try {
  const binary = join(dir, 'linea-media')
  const build = spawnSync(
    '/usr/bin/xcrun',
    [
      'clang',
      '-fobjc-arc',
      '-fblocks',
      '-DLINEA_TESTING',
      '-mmacosx-version-min=12.0',
      '-framework',
      'Cocoa',
      '-framework',
      'OSAKit',
      '-framework',
      'ApplicationServices',
      resolve('native/mac/main.m'),
      '-o',
      binary
    ],
    { stdio: 'inherit' }
  )
  assert.equal(build.status, 0, 'Native regression fixture must compile')
  copyFileSync('native/mac/media.js', join(dir, 'media.js'))
  async function probe(args, method) {
    const child = spawn(binary, args, { env: { ...process.env, LINEA_MEDIA_DEBUG: '1' } })
    let stdout = '',
      stderr = ''
    child.stdout.on('data', (chunk) => {
      stdout += chunk
    })
    child.stderr.on('data', (chunk) => {
      stderr += chunk
    })
    const timer = setTimeout(() => child.kill('SIGKILL'), 5000)
    try {
      const ended = new Promise((resolve, reject) => {
        child.on('error', reject)
        child.on('close', (code, signal) => resolve({ code, signal }))
      })
      child.stdin.end(JSON.stringify({ v: 1, id: 1, method }) + '\n')
      return {
        ...(await ended),
        stderr,
        messages: stdout.trim().split('\n').filter(Boolean).map(JSON.parse)
      }
    } finally {
      clearTimeout(timer)
    }
  }
  for (const method of ['snapshot', 'authorize']) {
    const result = await probe([], method)
    assert.equal(result.code, 0, result.stderr)
    assert.match(result.stderr, /permission main-loop callback/)
    assert.match(result.stderr, /permission end/)
    assert.match(result.stderr, /stdin closed/)
    assert.deepEqual(result.messages[1], {
      v: 1,
      type: 'response',
      id: 1,
      ok: false,
      reason: 'permission_required'
    })
    if (method === 'snapshot') assert.doesNotMatch(result.stderr, /prompt=1/)
    else assert.match(result.stderr, /prompt=1/)
  }
  const hung = await probe(['--test-hang'], 'snapshot')
  assert.equal(hung.code, 75, hung.stderr)
  assert.match(hung.stderr, /permission main-loop callback/)
  assert.match(hung.stderr, /timed out; terminating helper/)
  assert.equal(hung.messages.length, 1)
  console.log(
    'Mac permission checks leave the main loop responsive; denied access, explicit authorization, pipe closure and stalled requests passed.'
  )
} finally {
  rmSync(dir, { recursive: true, force: true })
}
