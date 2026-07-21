import { describe, it, expect } from 'vitest'
import { clampPrefs } from '../src/main/prefs'

describe('clampPrefs', () => {
  it('clamps opacity into [0.2, 1]', () => {
    expect(clampPrefs({ opacity: 5 }).opacity).toBe(1)
    expect(clampPrefs({ opacity: -2 }).opacity).toBe(0.2)
  })
  it('falls back to defaults for missing fields', () => {
    expect(clampPrefs({}).fontSize).toBe(16)
  })
})
