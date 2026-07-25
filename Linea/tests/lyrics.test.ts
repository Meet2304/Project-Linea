import { describe, it, expect } from 'vitest'
import { parseLrc, getCurrentLineIndex } from '../src/shared/lyrics'

const sample = '[00:00.00]Line one\n[00:02.50]Line two\n[00:05.00]Line three'

describe('parseLrc', () => {
  it('parses timestamps and text', () => {
    const lines = parseLrc(sample)
    expect(lines).toHaveLength(3)
    expect(lines[1]).toEqual({ timeMs: 2500, text: 'Line two' })
  })

  // Repeated choruses share one line of text across several cues. Parsed
  // naively the second timestamp ends up inside the text and the line is lost.
  it('expands a line carrying several timestamps', () => {
    expect(parseLrc('[00:01.00][00:05.00]Same words twice')).toEqual([
      { timeMs: 1000, text: 'Same words twice' },
      { timeMs: 5000, text: 'Same words twice' }
    ])
  })

  it('accepts single-digit minutes', () => {
    expect(parseLrc('[0:12.34]Early line')).toEqual([{ timeMs: 12_340, text: 'Early line' }])
  })

  it('accepts a colon-separated fraction', () => {
    expect(parseLrc('[00:01:50]Colon dialect')).toEqual([{ timeMs: 1500, text: 'Colon dialect' }])
  })

  it('scales the fraction by its width', () => {
    expect(parseLrc('[00:01.5]x')[0]?.timeMs).toBe(1500)
    expect(parseLrc('[00:01.05]x')[0]?.timeMs).toBe(1050)
    expect(parseLrc('[00:01.123]x')[0]?.timeMs).toBe(1123)
  })

  it('drops production credit rows', () => {
    const lines = parseLrc('[00:00.00] 作词 : Freddie Mercury\n[00:00.35]Is this the real life?')
    expect(lines).toEqual([{ timeMs: 350, text: 'Is this the real life?' }])
  })

  it('ignores ID tags and untimed lines', () => {
    expect(parseLrc('[ar:Queen]\n[ti:Bohemian Rhapsody]\nplain text\n[00:01.00]Real')).toEqual([
      { timeMs: 1000, text: 'Real' }
    ])
  })

  it('keeps a bracketed cue that appears mid-lyric as text', () => {
    expect(parseLrc('[00:01.00]meet me [00:05.00] later')).toEqual([
      { timeMs: 1000, text: 'meet me [00:05.00] later' }
    ])
  })

  it('returns nothing for lyrics with no timestamps at all', () => {
    expect(parseLrc('Just plain words\nAnother line')).toEqual([])
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
