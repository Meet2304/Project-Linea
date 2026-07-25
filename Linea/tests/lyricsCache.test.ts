import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { join } from 'node:path'

vi.mock('electron', () => ({
  app: { getPath: () => '/tmp/linea-lyrics-test', getVersion: () => '9.9.9' }
}))

const store = new Map<string, string>()

vi.mock('node:fs', async (importOriginal) => {
  const actual = await importOriginal<typeof import('node:fs')>()
  return {
    ...actual,
    existsSync: (p: string) => store.has(p),
    readFileSync: (p: string) => store.get(p)!,
    writeFileSync: (p: string, data: string) => {
      store.set(p, String(data))
    },
    mkdirSync: () => undefined
  }
})

const { getLyricsForTrack, resetNegativeCache } = await import('../src/main/lyricsCache')
const { resetBreakers } = await import('../src/main/lyrics/chain')
import type { LyricsProvider, ProviderId, ProviderOutcome } from '../src/main/lyrics/types'

const TRACK = {
  trackId: 'abc123',
  trackName: 'Bohemian Rhapsody',
  artistName: 'Queen',
  albumName: 'A Night at the Opera',
  durationSec: 354
}

/** Each case uses a fresh track id so the on-disk cache never short-circuits. */
let counter = 0
const freshTrack = (): typeof TRACK => ({ ...TRACK, trackId: `track${counter++}` })

const LINES = [
  { timeMs: 1000, text: 'Is this the real life' },
  { timeMs: 4500, text: 'Is this just fantasy' }
]

interface FakeProvider extends LyricsProvider {
  calls: number
}

function fake(id: ProviderId, outcome: ProviderOutcome): FakeProvider {
  const provider: FakeProvider = {
    id,
    calls: 0,
    lookup: async () => {
      provider.calls++
      return outcome
    }
  }
  return provider
}

const found = (): FakeProvider => fake('lrclib', { kind: 'lyrics', lines: LINES })

// Built with join() so the separator matches the module under test on every
// platform — a hardcoded '/' silently misses on Windows.
const cacheKey = (trackId: string): string =>
  join('/tmp/linea-lyrics-test', 'lyrics-cache', `${trackId}.json`)

beforeEach(() => {
  store.clear()
  resetNegativeCache()
  resetBreakers()
  vi.spyOn(console, 'error').mockImplementation(() => {})
})

afterEach(() => vi.unstubAllGlobals())

describe('getLyricsForTrack — results', () => {
  it('returns lyrics from the provider chain', async () => {
    const result = await getLyricsForTrack(freshTrack(), [found()])
    expect(result.status).toBe('ok')
    expect(result.lines).toEqual(LINES)
  })

  it("reports 'none' when providers answer but nobody has synced lyrics", async () => {
    const result = await getLyricsForTrack(freshTrack(), [
      fake('lrclib', { kind: 'no-match' }),
      fake('netease', { kind: 'no-match' })
    ])
    expect(result).toEqual({ lines: [], status: 'none' })
  })

  // The bug this guards: a blocked or unreachable service used to be reported
  // as a confident "this track has no lyrics".
  it("reports 'unreachable' when no provider could be reached", async () => {
    const result = await getLyricsForTrack(freshTrack(), [
      fake('lrclib', { kind: 'unreachable' }),
      fake('netease', { kind: 'unreachable' })
    ])
    expect(result).toEqual({ lines: [], status: 'unreachable' })
  })

  it('falls back to the second provider when the first is unreachable', async () => {
    const dead = fake('lrclib', { kind: 'unreachable' })
    const alive = fake('netease', { kind: 'lyrics', lines: LINES })
    const result = await getLyricsForTrack(freshTrack(), [dead, alive])
    expect(result.status).toBe('ok')
    expect(alive.calls).toBe(1)
  })

  it('rejects a track id that is not base62, without consulting providers', async () => {
    const provider = found()
    const result = await getLyricsForTrack({ ...TRACK, trackId: '../../etc/passwd' }, [provider])
    expect(result).toEqual({ lines: [], status: 'none' })
    expect(provider.calls).toBe(0)
  })
})

describe('getLyricsForTrack — disk cache', () => {
  it('serves a cached hit without consulting providers', async () => {
    const track = freshTrack()
    const provider = found()

    await getLyricsForTrack(track, [provider])
    const second = await getLyricsForTrack(track, [provider])

    expect(provider.calls).toBe(1)
    expect(second).toEqual({ lines: LINES, status: 'ok' })
  })

  it('writes a versioned envelope recording the winning provider', async () => {
    const track = freshTrack()
    await getLyricsForTrack(track, [fake('netease', { kind: 'lyrics', lines: LINES })])
    const written = JSON.parse(store.get(cacheKey(track.trackId))!)
    expect(written.v).toBe(2)
    expect(written.provider).toBe('netease')
    expect(written.lines).toEqual(LINES)
    expect(typeof written.fetchedAt).toBe('number')
  })

  // Files written before the envelope existed are still valid results.
  it('reads a legacy bare array left by an earlier version', async () => {
    const track = freshTrack()
    store.set(cacheKey(track.trackId), JSON.stringify(LINES))
    const provider = found()
    const result = await getLyricsForTrack(track, [provider])
    expect(result).toEqual({ lines: LINES, status: 'ok' })
    expect(provider.calls).toBe(0)
  })

  it('falls through to the providers when the cache file is corrupt', async () => {
    const track = freshTrack()
    store.set(cacheKey(track.trackId), '{ not json')
    const provider = found()
    expect((await getLyricsForTrack(track, [provider])).status).toBe('ok')
    expect(provider.calls).toBe(1)
  })

  it('never persists a miss to disk', async () => {
    const track = freshTrack()
    await getLyricsForTrack(track, [fake('lrclib', { kind: 'unreachable' })])
    expect(store.has(cacheKey(track.trackId))).toBe(false)
  })
})

describe('getLyricsForTrack — negative cache', () => {
  it('suppresses a repeat lookup after a miss', async () => {
    const track = freshTrack()
    const provider = fake('lrclib', { kind: 'no-match' })
    await getLyricsForTrack(track, [provider])
    const second = await getLyricsForTrack(track, [provider])
    expect(provider.calls).toBe(1)
    expect(second.status).toBe('none')
  })

  it('suppresses a repeat lookup after an unreachable result', async () => {
    const track = freshTrack()
    const provider = fake('lrclib', { kind: 'unreachable' })
    await getLyricsForTrack(track, [provider])
    const second = await getLyricsForTrack(track, [provider])
    expect(provider.calls).toBe(1)
    expect(second.status).toBe('unreachable')
  })

  it('does not leak a miss from one track to another', async () => {
    const provider = fake('lrclib', { kind: 'no-match' })
    await getLyricsForTrack(freshTrack(), [provider])
    await getLyricsForTrack(freshTrack(), [provider])
    expect(provider.calls).toBe(2)
  })
})
