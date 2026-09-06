import { afterEach, describe, it, expect, vi } from 'vitest'
import { LyricScheduler } from '../src/renderer/src/scheduler'
import { SessionMapper } from '../src/main/smtcState'
import { media, NOW } from './fixtures/media'
afterEach(() => vi.useRealTimers())
describe('rate-aware lyric scheduler', () => {
  it('arms the next boundary in wall time at the current rate', async () => {
    vi.useFakeTimers()
    vi.setSystemTime(NOW)
    const update = vi.fn(),
      scheduler = new LyricScheduler(update)
    const player = new SessionMapper().map(media({ rate: 2 }), NOW)
    scheduler.sync(
      [
        { timeMs: 10000, text: 'one' },
        { timeMs: 12000, text: 'two' }
      ],
      player
    )
    expect(update).toHaveBeenLastCalledWith(0)
    await vi.advanceTimersByTimeAsync(1016)
    expect(update).toHaveBeenLastCalledWith(1)
    scheduler.stop()
  })
  it('stops highlighting and timers when timing is unavailable or playback is paused', () => {
    vi.useFakeTimers()
    vi.setSystemTime(NOW)
    const update = vi.fn(),
      scheduler = new LyricScheduler(update)
    const player = new SessionMapper().map(media(), NOW)
    scheduler.sync(
      [
        { timeMs: 0, text: 'one' },
        { timeMs: 15000, text: 'two' }
      ],
      { ...player, timelineValid: false }
    )
    expect(update).toHaveBeenLastCalledWith(-1)
    expect(vi.getTimerCount()).toBe(0)
    scheduler.sync(
      [
        { timeMs: 0, text: 'one' },
        { timeMs: 15000, text: 'two' }
      ],
      { ...player, isPlaying: false }
    )
    expect(vi.getTimerCount()).toBe(0)
    scheduler.stop()
  })
})
