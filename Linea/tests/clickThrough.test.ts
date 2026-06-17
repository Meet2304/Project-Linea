import { describe, it, expect } from 'vitest'
import { nextClickThroughState } from '../src/main/clickThrough'

describe('nextClickThroughState', () => {
  it('flips false to true', () => {
    expect(nextClickThroughState(false)).toBe(true)
  })
  it('flips true to false', () => {
    expect(nextClickThroughState(true)).toBe(false)
  })
})
