import { EventEmitter } from 'node:events'
import { PassThrough } from 'node:stream'
import { beforeEach, afterEach, describe, it, expect, vi } from 'vitest'
import { media } from './fixtures/media'
const { spawn } = vi.hoisted(() => ({ spawn: vi.fn() }))
vi.mock('node:child_process', () => ({ spawn }))
import { SmtcBridge } from '../src/main/smtcBridge'
let bridge: SmtcBridge
const children: ReturnType<typeof child>[] = []
function child(): EventEmitter & {
  stdin: PassThrough
  stdout: PassThrough
  stderr: PassThrough
  kill: ReturnType<typeof vi.fn>
} {
  const process = Object.assign(new EventEmitter(), {
    stdin: new PassThrough(),
    stdout: new PassThrough(),
    stderr: new PassThrough(),
    kill: vi.fn()
  })
  return process
}
function send(value: unknown): void {
  children.at(-1)!.stdout.write(JSON.stringify(value) + '\n')
}
beforeEach(() => {
  vi.useFakeTimers()
  children.length = 0
  spawn.mockImplementation(() => {
    const c = child()
    children.push(c)
    return c
  })
  bridge = new SmtcBridge('helper.exe')
  bridge.start()
})
afterEach(() => {
  bridge.stop()
  vi.useRealTimers()
  vi.clearAllMocks()
})
describe('SMTC process protocol', () => {
  it('uses a hidden shell-free child and parses split UTF-8 responses', async () => {
    expect(spawn).toHaveBeenCalledWith(
      'helper.exe',
      ['--parent', String(process.pid)],
      expect.objectContaining({ windowsHide: true, shell: false })
    )
    send({ v: 1, type: 'ready' })
    let request: { id: number } = { id: 0 }
    children[0].stdin.on('data', (c) => {
      request = JSON.parse(c.toString())
    })
    const result = bridge.read()
    const bytes = Buffer.from(
      JSON.stringify({
        v: 1,
        type: 'response',
        id: request.id,
        ok: true,
        data: { sessions: [media({ title: '日本語 🎵' })] }
      }) + '\n'
    )
    for (let n = 0; n < bytes.length; n++) children[0].stdout.write(bytes.subarray(n, n + 1))
    expect(await result).toMatchObject({ ok: true, data: [{ id: '1:1:1', title: '日本語 🎵' }] })
  })
  it('fails pending work and restarts after a request timeout', async () => {
    send({ v: 1, type: 'ready' })
    const read = bridge.read()
    await vi.advanceTimersByTimeAsync(5000)
    expect(await read).toEqual({ ok: false, reason: 'timeout' })
    expect(children[0].kill).toHaveBeenCalled()
    await vi.advanceTimersByTimeAsync(1000)
    expect(children).toHaveLength(2)
    send({ v: 1, type: 'ready' })
    expect(
      await bridge.command({
        sessionId: '1:1',
        trackId: 'abc',
        mediaRevision: 1,
        command: { type: 'pause' }
      })
    ).toEqual({ ok: false, reason: 'session_unavailable' })
  })
  it('rejects malformed protocol and never restarts after stop', async () => {
    const unavailable = vi.fn()
    bridge.on('unavailable', unavailable)
    children[0].stdout.write('not json\n')
    expect(unavailable).toHaveBeenCalledOnce()
    bridge.stop()
    await vi.advanceTimersByTimeAsync(60000)
    expect(children).toHaveLength(1)
  })
  it('uses increasing restart delays and ignores a retired child', async () => {
    children[0].emit('error', new Error('missing'))
    await vi.advanceTimersByTimeAsync(1000)
    children[0].emit('exit', 1)
    expect(children).toHaveLength(2)
    children[1].emit('exit', 1)
    await vi.advanceTimersByTimeAsync(4999)
    expect(children).toHaveLength(2)
    await vi.advanceTimersByTimeAsync(1)
    expect(children).toHaveLength(3)
    children[2].emit('exit', 1)
    await vi.advanceTimersByTimeAsync(29999)
    expect(children).toHaveLength(3)
    await vi.advanceTimersByTimeAsync(1)
    expect(children).toHaveLength(4)
  })
  it('rejects an invalid response payload instead of trusting native data', async () => {
    send({ v: 1, type: 'ready' })
    let id = 0
    children[0].stdin.on('data', (c) => {
      id = JSON.parse(c.toString()).id
    })
    const read = bridge.read()
    send({ v: 1, type: 'response', id, ok: true, data: { sessions: [{}] } })
    expect(await read).toEqual({ ok: false, reason: 'source_unavailable' })
  })
})

it('keeps permission denial distinct from a crashed helper', async () => {
  send({ v: 1, type: 'ready' })
  let id = 0
  children[0].stdin.on('data', (c) => {
    id = JSON.parse(c.toString()).id
  })
  const read = bridge.read()
  send({ v: 1, type: 'response', id, ok: false, reason: 'permission_required' })
  expect(await read).toEqual({ ok: false, reason: 'permission_required' })
  expect(children[0].kill).not.toHaveBeenCalled()
})
it('holds reconciliation during an explicit Mac permission prompt', async () => {
  send({ v: 1, type: 'ready' })
  const requests: { id: number; method: string }[] = []
  children[0].stdin.on('data', (c) => requests.push(JSON.parse(c.toString())))
  const authorize = bridge.authorize()
  const read = bridge.read()
  await vi.advanceTimersByTimeAsync(10000)
  expect(children[0].kill).not.toHaveBeenCalled()
  expect(requests.map((r) => r.method)).toEqual(['authorize'])
  send({ v: 1, type: 'response', id: requests[0].id, ok: true, data: null })
  await authorize
  await vi.advanceTimersByTimeAsync(0)
  expect(requests[1].method).toBe('snapshot')
  send({ v: 1, type: 'response', id: requests[1].id, ok: true, data: { sessions: [] } })
  expect(await read).toEqual({ ok: true, data: [] })
})

describe('helper failure diagnostics', () => {
  it('logs an unexpected native exit code and fails pending work', async () => {
    const log = vi.spyOn(console, 'error').mockImplementation(() => {})
    try {
      send({ v: 1, type: 'ready' })
      const read = bridge.read()
      children[0].emit('exit', 75, null)
      expect(await read).toEqual({ ok: false, reason: 'source_unavailable' })
      expect(log).toHaveBeenCalledWith('Media helper: exited', { code: 75, signal: null })
    } finally {
      log.mockRestore()
    }
  })
})

describe('reported Mac launch and reconnect regressions', () => {
  beforeEach(() => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
  })
  afterEach(() => {
    vi.restoreAllMocks()
  })

  for (const code of ['EPERM', 'EACCES', 'ENOENT']) {
    it(
      'reports a blocked or missing helper (' + code + ') without an unhandled error',
      async () => {
        const unavailable = vi.fn()
        bridge.on('unavailable', unavailable)
        children[0].emit(
          'error',
          Object.assign(new Error(code + ': helper launch blocked'), { code })
        )
        expect(console.error).toHaveBeenCalledWith(
          'Media helper: launch failed',
          'helper.exe',
          code + ': helper launch blocked'
        )
        expect(unavailable).toHaveBeenCalledOnce()
        expect(await bridge.read()).toEqual({ ok: false, reason: 'source_unavailable' })
        await vi.advanceTimersByTimeAsync(1000)
        expect(children).toHaveLength(2)
      }
    )
  }

  it('logs a helper that never becomes ready and cancels its startup deadline on shutdown', async () => {
    await vi.advanceTimersByTimeAsync(5000)
    expect(console.error).toHaveBeenCalledWith('Media helper: startup timed out', 'helper.exe')
    expect(children[0].kill).toHaveBeenCalledOnce()
    await vi.advanceTimersByTimeAsync(1000)
    bridge.stop()
    await vi.advanceTimersByTimeAsync(60000)
    expect(children).toHaveLength(2)
    expect(
      vi
        .mocked(console.error)
        .mock.calls.filter(([message]) => message === 'Media helper: startup timed out')
    ).toHaveLength(1)
  })

  it('bounds ready-only snapshot hangs, backs off, then recovers with a fresh session', async () => {
    for (const delay of [1000, 5000, 30000, 30000]) {
      send({ v: 1, type: 'ready' })
      const active = children.at(-1)!
      const pending = bridge.read()
      await vi.advanceTimersByTimeAsync(5000)
      expect(await pending).toEqual({ ok: false, reason: 'timeout' })
      expect(active.kill).toHaveBeenCalledOnce()
      const count = children.length
      await vi.advanceTimersByTimeAsync(delay - 1)
      expect(children).toHaveLength(count)
      await vi.advanceTimersByTimeAsync(1)
      expect(children).toHaveLength(count + 1)
    }
    expect(console.error).toHaveBeenCalledWith(
      'Media helper: request timed out',
      expect.objectContaining({ method: 'snapshot' })
    )
    send({ v: 1, type: 'ready' })
    let id = 0
    children.at(-1)!.stdin.on('data', (chunk) => {
      id = JSON.parse(chunk.toString()).id
    })
    const recovered = bridge.read()
    send({ v: 1, type: 'response', id, ok: true, data: { sessions: [media()] } })
    expect(await recovered).toMatchObject({
      ok: true,
      data: [expect.objectContaining({ id: expect.stringMatching(/^5:/) })]
    })
    children.at(-1)!.emit('exit', 75, null)
    await vi.advanceTimersByTimeAsync(1000)
    expect(children).toHaveLength(6) // successful playback resets the retry backoff
  })

  it('ends a stuck explicit authorization and releases the waiting snapshot', async () => {
    send({ v: 1, type: 'ready' })
    const authorize = bridge.authorize()
    const read = bridge.read()
    await vi.advanceTimersByTimeAsync(59999)
    expect(children[0].kill).not.toHaveBeenCalled()
    await vi.advanceTimersByTimeAsync(1)
    expect(await authorize).toEqual({ ok: false, reason: 'timeout' })
    expect(await read).toEqual({ ok: false, reason: 'source_unavailable' })
    expect(console.error).toHaveBeenCalledWith(
      'Media helper: request timed out',
      expect.objectContaining({ method: 'authorize' })
    )
  })

  it('preserves the native permission-stage diagnostic before a watchdog exit', async () => {
    send({ v: 1, type: 'ready' })
    const read = bridge.read()
    children[0].stderr.write(
      'linea-media: permission probe begin target=com.spotify.client prompt=0\n'
    )
    children[0].stderr.write(
      'linea-media: request 1 method=snapshot timed out; terminating helper\n'
    )
    children[0].emit('exit', 75, null)
    expect(await read).toEqual({ ok: false, reason: 'source_unavailable' })
    expect(console.error).toHaveBeenCalledWith(
      'SMTC:',
      expect.stringContaining('permission probe begin')
    )
    expect(console.error).toHaveBeenCalledWith('SMTC:', expect.stringContaining('timed out'))
    expect(console.error).toHaveBeenCalledWith('Media helper: exited', { code: 75, signal: null })
  })
})
