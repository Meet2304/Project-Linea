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
