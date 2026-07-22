import { describe, it, expect } from 'vitest'
import { nextPollDelay, PLAYING_POLL_MS, IDLE_POLL_MS, MIN_POLL_MS } from '../src/shared/pollPolicy'

describe('nextPollDelay', () => {
  it('stops polling entirely when not authenticated', () => {
    expect(nextPollDelay({ authed: false, isPlaying: true, msToTrackEnd: 1000 })).toBeNull()
  })

  it('polls fast while playing', () => {
    expect(nextPollDelay({ authed: true, isPlaying: true, msToTrackEnd: null })).toBe(
      PLAYING_POLL_MS
    )
  })

  it('backs off while paused or idle', () => {
    expect(nextPollDelay({ authed: true, isPlaying: false, msToTrackEnd: null })).toBe(IDLE_POLL_MS)
  })

  it('shrinks the delay near the end of a track to catch the change', () => {
    expect(nextPollDelay({ authed: true, isPlaying: true, msToTrackEnd: 900 })).toBe(1150)
  })

  it('never drops below the minimum poll interval', () => {
    expect(nextPollDelay({ authed: true, isPlaying: true, msToTrackEnd: 0 })).toBe(MIN_POLL_MS)
  })

  it('ignores track end when it is far away', () => {
    expect(nextPollDelay({ authed: true, isPlaying: true, msToTrackEnd: 120_000 })).toBe(
      PLAYING_POLL_MS
    )
  })
})
