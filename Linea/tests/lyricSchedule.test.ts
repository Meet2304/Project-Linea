import { describe, it, expect } from 'vitest'
import { nextBoundary } from '../src/shared/lyricSchedule'
import type { LyricLine } from '../src/shared/lyrics'

const lines: LyricLine[] = [
  { timeMs: 1000, text: 'one' },
  { timeMs: 5000, text: 'two' },
  { timeMs: 9000, text: 'three' }
]

describe('nextBoundary', () => {
  it('returns null for empty lines', () => {
    expect(nextBoundary([], 0)).toBeNull()
  })

  it('targets the first line before any line is active', () => {
    expect(nextBoundary(lines, 0)).toEqual({ index: 0, delayMs: 1000 })
  })

  it('targets the following line while one is active', () => {
    expect(nextBoundary(lines, 2000)).toEqual({ index: 1, delayMs: 3000 })
  })

  it('fires immediately when the position sits exactly on a boundary', () => {
    expect(nextBoundary(lines, 5000)).toEqual({ index: 2, delayMs: 4000 })
  })

  it('returns null past the last line', () => {
    expect(nextBoundary(lines, 9000)).toBeNull()
    expect(nextBoundary(lines, 60_000)).toBeNull()
  })

  it('never returns a negative delay', () => {
    const boundary = nextBoundary(lines, 4999.5)
    expect(boundary?.delayMs).toBeGreaterThanOrEqual(0)
  })
})
