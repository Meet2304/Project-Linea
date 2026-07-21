import { describe, it, expect } from 'vitest'
import { generateCodeVerifier, generateCodeChallenge } from '../src/main/spotifyAuth'

describe('PKCE helpers', () => {
  it('verifier contains no padding or unsafe base64 characters', () => {
    expect(generateCodeVerifier()).not.toMatch(/[+/=]/)
  })
  it('challenge is deterministic for a given verifier', () => {
    const verifier = generateCodeVerifier()
    expect(generateCodeChallenge(verifier)).toBe(generateCodeChallenge(verifier))
  })
  it('different verifiers produce different challenges', () => {
    expect(generateCodeChallenge(generateCodeVerifier())).not.toBe(
      generateCodeChallenge(generateCodeVerifier())
    )
  })
})
