import { EventEmitter } from 'node:events'
import { describe, it, expect, vi, afterEach } from 'vitest'
import { PlaybackController, validCommandRequest } from '../src/main/playbackController'
import type { SmtcBridge } from '../src/main/smtcBridge'
import type { MediaSession } from '../src/main/smtcState'
import type { LyricsResult } from '../src/shared/lyrics'
import { media, NOW } from './fixtures/media'
afterEach(() => vi.useRealTimers())
// Mock return signatures are inferred so assertions retain their precise types.
// eslint-disable-next-line @typescript-eslint/explicit-function-return-type
function setup(lookup = vi.fn(async (): Promise<LyricsResult> => ({ lines: [], status: 'none' }))) {
  vi.useFakeTimers()
  vi.setSystemTime(NOW)
  const bridge = Object.assign(new EventEmitter(), {
    start: vi.fn(),
    stop: vi.fn(),
    resume: vi.fn(),
    read: vi.fn(async () => ({ ok: true as const, data: [media()] as MediaSession[] })),
    command: vi.fn(async () => ({ ok: true as const, data: null }))
  })
  const publish = vi.fn()
  const controller = new PlaybackController(bridge as unknown as SmtcBridge, lookup, publish)
  controller.start()
  return { bridge, controller, lookup, publish }
}
describe('playback lifecycle', () => {
  it('starts without auth, clears lyrics on a skip, and rejects late results', async () => {
    let resolve!: (r: LyricsResult) => void
    const lookup = vi.fn(
      () =>
        new Promise<LyricsResult>((r) => {
          resolve = r
        })
    )
    const { controller, bridge } = setup(lookup)
    await controller.poll()
    expect(bridge.start).toHaveBeenCalledOnce()
    const first = resolve
    bridge.read.mockResolvedValue({ ok: true, data: [media({ title: 'Other' })] })
    await controller.poll()
    first({ status: 'ok', lines: [{ timeMs: 0, text: 'Old words' }] })
    await vi.advanceTimersByTimeAsync(0)
    expect(controller.getSnapshot().lyrics.lines).toEqual([])
    resolve({ status: 'ok', lines: [{ timeMs: 0, text: 'New words' }] })
    await vi.advanceTimersByTimeAsync(0)
    expect(controller.getSnapshot().lyrics.lines[0]?.text).toBe('New words')
    controller.stop()
  })
  it('deduplicates in-flight lookup when returning to a track', async () => {
    let resolve!: (r: LyricsResult) => void
    const lookup = vi.fn(
      () =>
        new Promise<LyricsResult>((r) => {
          resolve = r
        })
    )
    const { controller, bridge } = setup(lookup)
    await controller.poll()
    bridge.read.mockResolvedValue({ ok: true, data: [] })
    await controller.poll()
    bridge.read.mockResolvedValue({ ok: true, data: [media()] })
    await controller.poll()
    expect(lookup).toHaveBeenCalledOnce()
    resolve({ status: 'ok', lines: [{ timeMs: 0, text: 'Words' }] })
    await vi.advanceTimersByTimeAsync(0)
    await vi.advanceTimersByTimeAsync(0)
    expect(controller.getSnapshot().lyrics.lines).toHaveLength(1)
    controller.stop()
  })
  it('retries unreachable lyrics after negative-cache expiry', async () => {
    const lookup = vi.fn(async (): Promise<LyricsResult> => ({ lines: [], status: 'unreachable' }))
    const { controller } = setup(lookup)
    await controller.poll()
    await vi.advanceTimersByTimeAsync(0)
    await vi.advanceTimersByTimeAsync(60101)
    expect(lookup).toHaveBeenCalledTimes(2)
    controller.stop()
  })
  it('publishes idle versus failure, and discards reads finishing after resume', async () => {
    const { controller, bridge } = setup()
    await controller.poll()
    bridge.read.mockResolvedValue({ ok: true, data: [] })
    await controller.poll()
    expect(controller.getSnapshot().sourceStatus).toBe('idle')
    bridge.emit('unavailable')
    expect(controller.getSnapshot().sourceStatus).toBe('unavailable')
    expect(controller.getSnapshot().player).toBeNull()
    let resolve!: (r: { ok: true; data: MediaSession[] }) => void
    bridge.read.mockImplementation(
      () =>
        new Promise((r) => {
          resolve = r
        })
    )
    const read = controller.poll()
    controller.resume()
    resolve({ ok: true, data: [media()] })
    await read
    expect(controller.getSnapshot().player).toBeNull()
    controller.stop()
  })
  it('does not overlap reads when events arrive in a burst', async () => {
    const { controller, bridge } = setup()
    let resolve!: (r: { ok: true; data: MediaSession[] }) => void
    bridge.read.mockImplementation(
      () =>
        new Promise((r) => {
          resolve = r
        })
    )
    const read = controller.poll()
    for (let n = 0; n < 20; n++) bridge.emit('changed')
    await vi.advanceTimersByTimeAsync(100)
    expect(bridge.read).toHaveBeenCalledOnce()
    resolve({ ok: true, data: [] })
    await read
    controller.stop()
  })
  it('rejects stale session/track commands and invalid or unavailable seeks', async () => {
    const { controller, bridge } = setup()
    await controller.poll()
    const p = controller.getSnapshot().player!
    const target = { sessionId: p.sessionId, trackId: p.trackId, mediaRevision: p.mediaRevision }
    expect(
      await controller.command({ ...target, command: { type: 'seek', positionMs: Infinity } })
    ).toMatchObject({ ok: false, reason: 'invalid_request' })
    expect(
      await controller.command({ ...target, sessionId: 'old', command: { type: 'next' } })
    ).toMatchObject({ ok: false, reason: 'session_unavailable' })
    expect(
      await controller.command({ ...target, command: { type: 'seek', positionMs: 999999 } })
    ).toMatchObject({ ok: false, reason: 'invalid_request' })
    expect(bridge.command).not.toHaveBeenCalled()
    expect(await controller.command({ ...target, command: { type: 'pause' } })).toEqual({
      ok: true,
      data: null
    })
    controller.stop()
  })
  it('does not look up ambiguous metadata', async () => {
    const { controller, bridge, lookup } = setup()
    bridge.read.mockResolvedValue({ ok: true, data: [media({ artist: '' })] })
    await controller.poll()
    expect(lookup).not.toHaveBeenCalled()
    controller.stop()
  })
  it('leaves non-Windows hosts in an explicit unsupported state', () => {
    const c = new PlaybackController(null, vi.fn(), vi.fn())
    c.start()
    expect(c.getSnapshot().sourceStatus).toBe('unsupported')
    c.stop()
  })
  it('validates commands arriving from IPC', () => {
    for (const r of [
      null,
      {},
      'play',
      {
        sessionId: 'a',
        trackId: 't',
        mediaRevision: 1,
        command: { type: 'repeat', mode: 'random' }
      }
    ])
      expect(validCommandRequest(r)).toBe(false)
  })
})
