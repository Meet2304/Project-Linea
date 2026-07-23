import { describe, it, expect } from 'vitest'
import { clampPrefs } from '../src/main/prefs'

describe('clampPrefs', () => {
  it('clamps opacity into [0.6, 1] (legibility floor for panel alpha)', () => {
    expect(clampPrefs({ opacity: 5 }).opacity).toBe(1)
    expect(clampPrefs({ opacity: 0.2 }).opacity).toBe(0.6)
    expect(clampPrefs({ opacity: -2 }).opacity).toBe(0.6)
  })

  it('clamps lyricsSize to a known preset, defaulting to medium', () => {
    expect(clampPrefs({ lyricsSize: 'small' }).lyricsSize).toBe('small')
    expect(clampPrefs({ lyricsSize: 'large' }).lyricsSize).toBe('large')
    expect(clampPrefs({ lyricsSize: 'huge' as never }).lyricsSize).toBe('medium')
    expect(clampPrefs({}).lyricsSize).toBe('medium')
  })

  it('migrates old prefs files (opacity + legacy fontSize) with defaults', () => {
    const migrated = clampPrefs({ opacity: 0.9, fontSize: 16 } as never)
    expect(migrated).toEqual({
      opacity: 0.9,
      lyricsSize: 'medium',
      theme: 'light',
      pinned: true,
      lyricsExpanded: true
    })
  })

  it('clamps invalid theme values to light', () => {
    expect(clampPrefs({ theme: 'neon' as never }).theme).toBe('light')
    expect(clampPrefs({ theme: 'dark' }).theme).toBe('dark')
  })

  it('coerces non-boolean toggles to their defaults', () => {
    expect(clampPrefs({ pinned: 'yes' as never }).pinned).toBe(true)
    expect(clampPrefs({ lyricsExpanded: 0 as never }).lyricsExpanded).toBe(true)
    expect(clampPrefs({ pinned: false }).pinned).toBe(false)
  })
})
