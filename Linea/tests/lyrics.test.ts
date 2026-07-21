import { describe, it, expect } from 'vitest'
import { parseLrc, getCurrentLineIndex } from '../src/shared/lyrics'

const sample = '[00:00.00]Line one\n[00:02.50]Line two\n[00:05.00]Line three'

describe('parseLrc', () => {
  it('parses timestamps and text', () => {
    const lines = parseLrc(sample)
    expect(lines).toHaveLength(3)
    expect(lines[1]).toEqual({ timeMs: 2500, text: 'Line two' })
  })
})

describe('getCurrentLineIndex', () => {
  const lines = parseLrc(sample)
  it('returns the first line at time zero', () => {
    expect(getCurrentLineIndex(lines, 0)).toBe(0)
  })
  it('returns the right line mid-song', () => {
    expect(getCurrentLineIndex(lines, 3000)).toBe(1)
  })
  it('returns the last line after the song ends', () => {
    expect(getCurrentLineIndex(lines, 999_999)).toBe(2)
  })
})
