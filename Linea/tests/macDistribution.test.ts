import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { checkMacDistribution } from '../scripts/check-mac-distribution.mjs'

describe('reported Mac signing and launch restrictions', () => {
  beforeEach(() => {
    vi.spyOn(console, 'log').mockImplementation(() => {})
    vi.spyOn(console, 'error').mockImplementation(() => {})
  })
  afterEach(() => vi.restoreAllMocks())
  for (const failedCheck of [0, 1, 2]) {
    it('blocks stable distribution when security check ' + failedCheck + ' rejects the app', () => {
      let index = 0
      const run = vi.fn(() => ({ status: index++ === failedCheck ? 1 : 0 }))
      expect(checkMacDistribution('/Applications/Linea.app', run)).toBe(false)
      expect(run).toHaveBeenCalledTimes(3)
    })
  }
  it('blocks on a missing tool or signal termination', () => {
    expect(
      checkMacDistribution('/Applications/Linea.app', () => ({
        status: null,
        error: new Error('ENOENT')
      }))
    ).toBe(false)
    expect(
      checkMacDistribution('/Applications/Linea.app', () => ({ status: null, signal: 'SIGTERM' }))
    ).toBe(false)
  })
  it('requires all checks and passes paths with spaces without using a shell', () => {
    const path = '/Applications/Linea test é.app'
    const run = vi.fn(() => ({ status: 0 }))
    expect(checkMacDistribution(path, run)).toBe(true)
    expect(run.mock.calls).toEqual([
      [
        '/usr/bin/codesign',
        ['--verify', '--deep', '--strict', '--verbose=2', path],
        { stdio: 'inherit' }
      ],
      [
        '/usr/sbin/spctl',
        ['--assess', '--type', 'execute', '--verbose=4', path],
        { stdio: 'inherit' }
      ],
      ['/usr/bin/xcrun', ['stapler', 'validate', path], { stdio: 'inherit' }]
    ])
  })
})
