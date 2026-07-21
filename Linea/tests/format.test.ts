import { describe, it, expect } from 'vitest'
import { formatTime, formatRemaining } from '../src/shared/format'

describe('formatTime', () => {
  it('formats milliseconds as M:SS', () => {
    expect(formatTime(0)).toBe('0:00')
    expect(formatTime(59_999)).toBe('0:59')
    expect(formatTime(60_000)).toBe('1:00')
    expect(formatTime(83_000)).toBe('1:23')
    expect(formatTime(600_000)).toBe('10:00')
  })

  it('clamps negative and non-finite input to 0:00', () => {
    expect(formatTime(-500)).toBe('0:00')
    expect(formatTime(NaN)).toBe('0:00')
    expect(formatTime(Infinity)).toBe('0:00')
  })
})

describe('formatRemaining', () => {
  it('formats the remaining time with a leading minus', () => {
    expect(formatRemaining(227_000, 95_000)).toBe('-2:12')
  })

  it('clamps at -0:00 when position passes duration', () => {
    expect(formatRemaining(100_000, 150_000)).toBe('-0:00')
  })
})
