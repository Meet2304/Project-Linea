import { describe, it, expect } from 'vitest'
import { clampPrefs } from '../src/main/prefs'

describe('clampPrefs', () => {
  it('locks opacity to the solid default (slider deferred)', () => {
    expect(clampPrefs({ opacity: 5 }).opacity).toBe(0.95)
    expect(clampPrefs({ opacity: 0.2 }).opacity).toBe(0.95)
    expect(clampPrefs({ opacity: 0 }).opacity).toBe(0.95)
    expect(clampPrefs({}).opacity).toBe(0.95)
  })

  it('clamps lyricsSize to a known preset, defaulting to medium', () => {
    expect(clampPrefs({ lyricsSize: 'small' }).lyricsSize).toBe('small')
    expect(clampPrefs({ lyricsSize: 'large' }).lyricsSize).toBe('large')
    expect(clampPrefs({ lyricsSize: 'huge' as never }).lyricsSize).toBe('medium')
    expect(clampPrefs({}).lyricsSize).toBe('medium')
  })

  it('migrates old prefs files (legacy fontSize) and resets opacity to default', () => {
    const migrated = clampPrefs({ opacity: 0.9, fontSize: 16 } as never)
    expect(migrated).toEqual({
      opacity: 0.95,
      lyricsSize: 'medium',
      theme: 'light',
      pinned: true,
      lyricsExpanded: true,
      showTimestamps: false
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
