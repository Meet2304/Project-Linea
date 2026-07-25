import { describe, it, expect, beforeEach } from 'vitest'
import { resolveLyrics, resetBreakers } from '../src/main/lyrics/chain'
import type { LyricsProvider, LyricsQuery, ProviderId, ProviderOutcome } from '../src/main/lyrics/types'

const QUERY: LyricsQuery = {
  trackName: 'Bohemian Rhapsody',
  artistName: 'Queen',
  albumName: 'A Night at the Opera',
  durationSec: 354
}

const LINES = [
  { timeMs: 1000, text: 'Is this the real life' },
  { timeMs: 4500, text: 'Is this just fantasy' }
]

const lyrics: ProviderOutcome = { kind: 'lyrics', lines: LINES }
const instrumental: ProviderOutcome = { kind: 'instrumental' }
const noMatch: ProviderOutcome = { kind: 'no-match' }
const unreachable: ProviderOutcome = { kind: 'unreachable' }

interface FakeProvider extends LyricsProvider {
  calls: number
}

/** Returns the scripted outcome, repeating the last one once exhausted. */
function fake(id: ProviderId, ...script: ProviderOutcome[]): FakeProvider {
  const provider: FakeProvider = {
    id,
    calls: 0,
    lookup: async () => {
      const outcome = script[Math.min(provider.calls, script.length - 1)] ?? noMatch
      provider.calls++
      return outcome
    }
  }
  return provider
}

beforeEach(() => resetBreakers())

describe('resolveLyrics — outcome combination', () => {
  it('returns lyrics from the first provider and never calls the second', async () => {
    const a = fake('lrclib', lyrics)
    const b = fake('netease', lyrics)
    const { result, provider } = await resolveLyrics(QUERY, [a, b])
    expect(result.status).toBe('ok')
    expect(result.lines).toHaveLength(2)
    expect(provider).toBe('lrclib')
    expect(b.calls).toBe(0)
  })

  it('stops on instrumental without consulting the fallback', async () => {
    const a = fake('lrclib', instrumental)
    const b = fake('netease', lyrics)
    const { result } = await resolveLyrics(QUERY, [a, b])
    expect(result.status).toBe('none')
    expect(b.calls).toBe(0)
  })

  it('falls through a no-match to the second provider', async () => {
    const a = fake('lrclib', noMatch)
    const b = fake('netease', lyrics)
    const { result, provider } = await resolveLyrics(QUERY, [a, b])
    expect(result.status).toBe('ok')
    expect(provider).toBe('netease')
  })

  it('falls through an unreachable provider to the second', async () => {
    const a = fake('lrclib', unreachable)
    const b = fake('netease', lyrics)
    const { result, provider } = await resolveLyrics(QUERY, [a, b])
    expect(result.status).toBe('ok')
    expect(provider).toBe('netease')
  })

  // The core honesty rule: only claim the track has no lyrics if somebody
  // actually looked and said so.
  it.each<[string, ProviderOutcome, ProviderOutcome, 'none' | 'unreachable']>([
    ['no-match + no-match', noMatch, noMatch, 'none'],
    ['no-match + unreachable', noMatch, unreachable, 'none'],
    ['unreachable + no-match', unreachable, noMatch, 'none'],
    ['unreachable + unreachable', unreachable, unreachable, 'unreachable']
  ])('%s => %s', async (_label, first, second, expected) => {
    const { result } = await resolveLyrics(QUERY, [fake('lrclib', first), fake('netease', second)])
    expect(result.status).toBe(expected)
    expect(result.lines).toEqual([])
  })

  it('reports unreachable when there are no providers at all', async () => {
    const { result } = await resolveLyrics(QUERY, [])
    expect(result.status).toBe('unreachable')
  })

  it('keeps looking when a provider claims lyrics but yields no usable lines', async () => {
    const a = fake('lrclib', { kind: 'lyrics', lines: [] })
    const b = fake('netease', lyrics)
    const { result, provider } = await resolveLyrics(QUERY, [a, b])
    expect(result.status).toBe('ok')
    expect(provider).toBe('netease')
  })
})

describe('resolveLyrics — line normalization', () => {
  it('sorts by timestamp and drops negative entries', async () => {
    const messy = fake('lrclib', {
      kind: 'lyrics',
      lines: [
        { timeMs: 4500, text: 'second' },
        { timeMs: -1, text: 'garbage' },
        { timeMs: 1000, text: 'first' }
      ]
    })
    const { result } = await resolveLyrics(QUERY, [messy])
    expect(result.lines.map((l) => l.text)).toEqual(['first', 'second'])
  })
})

describe('resolveLyrics — budget', () => {
  it('skips the second provider when the budget is spent', async () => {
    let clock = 0
    const a: LyricsProvider = {
      id: 'lrclib',
      lookup: async () => {
        clock += 11_000
        return noMatch
      }
    }
    const b = fake('netease', lyrics)
    const { result } = await resolveLyrics(QUERY, [a, b], {
      totalBudgetMs: 12_000,
      now: () => clock
    })
    expect(b.calls).toBe(0)
    // The first provider answered, so this is 'none', not 'unreachable'.
    expect(result.status).toBe('none')
  })

  it('reports unreachable when the budget is spent and nobody answered', async () => {
    let clock = 0
    const a: LyricsProvider = {
      id: 'lrclib',
      lookup: async () => {
        clock += 11_000
        return unreachable
      }
    }
    const b = fake('netease', lyrics)
    const { result } = await resolveLyrics(QUERY, [a, b], {
      totalBudgetMs: 12_000,
      now: () => clock
    })
    expect(b.calls).toBe(0)
    expect(result.status).toBe('unreachable')
  })
})

describe('resolveLyrics — circuit breaker', () => {
  it('stops calling a provider after three consecutive failures', async () => {
    const dead = fake('lrclib', unreachable)
    const alive = fake('netease', lyrics)

    for (let i = 0; i < 3; i++) await resolveLyrics(QUERY, [dead, alive])
    expect(dead.calls).toBe(3)

    await resolveLyrics(QUERY, [dead, alive])
    expect(dead.calls).toBe(3) // tripped — skipped entirely
  })

  it('still serves lyrics from the surviving provider while tripped', async () => {
    const dead = fake('lrclib', unreachable)
    const alive = fake('netease', lyrics)
    for (let i = 0; i < 4; i++) await resolveLyrics(QUERY, [dead, alive])
    const { result, provider } = await resolveLyrics(QUERY, [dead, alive])
    expect(result.status).toBe('ok')
    expect(provider).toBe('netease')
  })

  it('reports unreachable when every provider is tripped', async () => {
    const a = fake('lrclib', unreachable)
    const b = fake('netease', unreachable)
    for (let i = 0; i < 3; i++) await resolveLyrics(QUERY, [a, b])
    const { result } = await resolveLyrics(QUERY, [a, b])
    expect(result.status).toBe('unreachable')
    expect(a.calls).toBe(3)
    expect(b.calls).toBe(3)
  })

  it('recovers once the trip window expires', async () => {
    let clock = 0
    const flaky = fake('lrclib', unreachable, unreachable, unreachable, lyrics)
    const opts = { now: () => clock }

    for (let i = 0; i < 3; i++) await resolveLyrics(QUERY, [flaky], opts)
    await resolveLyrics(QUERY, [flaky], opts)
    expect(flaky.calls).toBe(3)

    clock += 5 * 60_000 + 1
    const { result } = await resolveLyrics(QUERY, [flaky], opts)
    expect(flaky.calls).toBe(4)
    expect(result.status).toBe('ok')
  })

  it('clears the failure count after a successful answer', async () => {
    const flaky = fake('lrclib', unreachable, unreachable, noMatch, unreachable, unreachable)
    for (let i = 0; i < 5; i++) await resolveLyrics(QUERY, [flaky])
    // Without the reset, calls 1,2,4 would have tripped it before call 5.
    expect(flaky.calls).toBe(5)
  })
})
