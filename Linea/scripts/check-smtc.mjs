import { spawn } from 'node:child_process'
import { createInterface } from 'node:readline'
import { resolve } from 'node:path'
const path = resolve(process.argv[2] ?? 'dist/win-unpacked/resources/smtc/linea-smtc.exe')
const child = spawn(path, ['--parent', String(process.pid)], {
  windowsHide: true,
  stdio: ['pipe', 'pipe', 'inherit']
})
let next = 0
const pending = new Map()
const ready = new Promise((resolve, reject) => {
  const timer = setTimeout(() => reject(new Error('Helper startup timed out')), 5000)
  child.on('error', reject)
  child.on('exit', (code) => {
    clearTimeout(timer)
    reject(new Error('Helper exited: ' + code))
  })
  createInterface({ input: child.stdout }).on('line', (line) => {
    const message = JSON.parse(line)
    if (message.type === 'ready') {
      clearTimeout(timer)
      resolve()
    }
    if (message.type === 'response') pending.get(message.id)?.(message)
  })
})
async function request(fields) {
  const id = ++next
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      pending.delete(id)
      reject(new Error('Request timed out'))
    }, 5000)
    pending.set(id, (result) => {
      clearTimeout(timer)
      pending.delete(id)
      resolve(result)
    })
    child.stdin.write(JSON.stringify({ v: 1, id, ...fields }) + '\n')
  })
}
async function snapshot() {
  const r = await request({ method: 'snapshot' })
  if (!r.ok) throw new Error(r.reason)
  return r.data.sessions
}
const delay = (ms) => new Promise((r) => setTimeout(r, ms))
try {
  await ready
  const initial = (await snapshot()).find((s) => s.appId.toLowerCase().includes('spotify'))
  if (!initial) throw new Error('Start Spotify desktop playback before running this check.')
  console.log('Packaged helper:', path)
  console.log('Initial session:', JSON.stringify(initial))
  if (process.argv.includes('--controls')) {
    let current = initial
    const command = async (type, fields = {}) => {
      current = (await snapshot()).find((s) => s.id === initial.id)
      if (!current) throw new Error('Spotify session disappeared')
      const result = await request({
        method: 'command',
        sessionId: current.id,
        mediaRevision: current.mediaRevision,
        command: type,
        ...fields
      })
      if (!result.ok) throw new Error(type + ': ' + result.reason)
      await delay(500)
      current = (await snapshot()).find((s) => s.id === initial.id)
      console.log(
        type,
        JSON.stringify({
          status: current?.status,
          title: current?.title,
          shuffle: current?.shuffle,
          repeat: current?.repeat,
          position: current?.timeline.positionMs
        })
      )
      return current
    }
    const confirm = async (label, matches) => {
      const deadline = Date.now() + 5000
      do {
        current = (await snapshot()).find((s) => s.id === initial.id)
        if (!current) throw new Error('Spotify session disappeared')
        if (matches(current)) {
          console.log(
            label + ' confirmed',
            JSON.stringify({ title: current.title, position: current.timeline.positionMs })
          )
          return
        }
        await delay(200)
      } while (Date.now() < deadline)
      throw new Error(label + ' was accepted but playback did not confirm it')
    }
    try {
      await command('pause')
      if (current.status !== 'paused') throw new Error('Pause was not confirmed')
      await command('play')
      if (current.status !== 'playing') throw new Error('Play was not confirmed')
      if (initial.controls.seek) {
        const target = Math.min(initial.timeline.endMs - 2000, 15000)
        await command('seek', { positionMs: target })
        if (Math.abs(current.timeline.positionMs - target) > 3000)
          throw new Error('Seek was not confirmed')
      }
      if (initial.controls.shuffle && initial.shuffle !== null) {
        await command('shuffle', { state: !initial.shuffle })
        if (current.shuffle === initial.shuffle) throw new Error('Shuffle was not confirmed')
        await command('shuffle', { state: initial.shuffle })
      }
      if (initial.controls.repeat && initial.repeat !== null) {
        const mode = initial.repeat === 'off' ? 'context' : 'off'
        await command('repeat', { mode })
        if (current.repeat !== mode) throw new Error('Repeat was not confirmed')
        await command('repeat', { mode: initial.repeat })
      }
      if (initial.controls.next && initial.controls.previous) {
        const before = current.title + '\0' + current.artist
        await command('next')
        await confirm('next', (s) => s.title + '\0' + s.artist !== before)
        const nextTrack = current.title + '\0' + current.artist
        await command('previous')
        await confirm(
          'previous',
          (s) => s.title + '\0' + s.artist !== nextTrack || s.timeline.positionMs < 1500
        )
      }
    } finally {
      current = (await snapshot()).find((s) => s.id === initial.id)
      if (current?.controls.shuffle && initial.shuffle !== null)
        await command('shuffle', { state: initial.shuffle })
      if (current?.controls.repeat && initial.repeat !== null)
        await command('repeat', { mode: initial.repeat })
      if (current?.title === initial.title && current.controls.seek)
        await command('seek', { positionMs: initial.timeline.positionMs })
      if (current) await command(initial.status === 'playing' ? 'play' : 'pause')
    }
  }
  console.log('SMTC smoke check passed.')
} finally {
  child.stdin.end()
  child.kill()
}
