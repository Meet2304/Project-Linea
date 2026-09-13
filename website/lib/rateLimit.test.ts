import { describe, expect, it } from 'bun:test'
import { allow } from './rateLimit'

describe('allow', () => {
  it('permits up to the limit inside the window, then refuses', () => {
    const key = `test-${Math.random()}`
    expect(allow(key, 2, 60_000)).toBe(true)
    expect(allow(key, 2, 60_000)).toBe(true)
    expect(allow(key, 2, 60_000)).toBe(false)
  })

  it('refuses empty keys', () => {
    expect(allow('', 5, 60_000)).toBe(false)
  })
})
