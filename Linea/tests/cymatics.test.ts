import { describe, it, expect } from 'vitest'
import { renderPixels, hashSeed, styleForSeed } from '../src/renderer/src/cymatics'

describe('hashSeed', () => {
  it('is deterministic', () => {
    expect(hashSeed('spotify:track:abc')).toBe(hashSeed('spotify:track:abc'))
  })

  it('differs across inputs', () => {
    expect(hashSeed('track-a')).not.toBe(hashSeed('track-b'))
  })

  it('always returns an unsigned integer', () => {
    for (const input of ['', 'x', 'a-long-track-id-000111222333']) {
      const seed = hashSeed(input)
      expect(seed).toBeGreaterThanOrEqual(0)
      expect(Number.isInteger(seed)).toBe(true)
    }
  })
})

describe('styleForSeed', () => {
  it('maps seeds to a valid pattern style', () => {
    expect(['ripple', 'chladni', 'flow', 'lattice']).toContain(styleForSeed(hashSeed('abc')))
  })
})

describe('renderPixels', () => {
  const opts = { style: 'ripple', color: '#3a6098', seed: 42 } as const

  it('produces an RGBA buffer of the right size', () => {
    const pixels = renderPixels(16, 16, opts)
    expect(pixels.length).toBe(16 * 16 * 4)
  })

  it('is deterministic for the same seed', () => {
    expect(renderPixels(16, 16, opts)).toEqual(renderPixels(16, 16, opts))
  })

  it('differs across seeds', () => {
    const a = renderPixels(16, 16, { ...opts, seed: 1 })
    const b = renderPixels(16, 16, { ...opts, seed: 2 })
    expect(a).not.toEqual(b)
  })

  it('writes the requested color into covered pixels', () => {
    const pixels = renderPixels(32, 32, { ...opts, dither: 0.5 })
    let found = false
    for (let i = 0; i < pixels.length; i += 4) {
      if (pixels[i + 3] > 0) {
        expect(pixels[i]).toBe(0x3a)
        expect(pixels[i + 1]).toBe(0x60)
        expect(pixels[i + 2]).toBe(0x98)
        found = true
        break
      }
    }
    expect(found).toBe(true)
  })
})
