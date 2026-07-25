import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

vi.mock('electron', () => ({ app: { getVersion: () => '9.9.9' } }))

const { lrclibProvider } = await import('../src/main/lyrics/lrclib')
import type { LyricsQuery } from '../src/main/lyrics/types'

const QUERY: LyricsQuery = {
  trackName: 'Bohemian Rhapsody',
  artistName: 'Queen',
  albumName: 'A Night at the Opera',
  durationSec: 354
}

const SYNCED = '[00:01.00]Is this the real life\n[00:04.50]Is this just fantasy'

const track = (over: Record<string, unknown> = {}): Record<string, unknown> => ({
  trackName: 'Bohemian Rhapsody',
  artistName: 'Queen',
  albumName: 'A Night at the Opera',
  duration: 354,
  instrumental: false,
  plainLyrics: 'Is this the real life',
  syncedLyrics: SYNCED,
  ...over
})

const json = (body: unknown, status = 200): Response =>
  new Response(JSON.stringify(body), { status })

interface Routes {
  get?: () => Response | Promise<Response>
  search?: () => Response | Promise<Response>
}

/** Routes stubbed fetch on pathname and records each call. */
function route(routes: Routes): { calls: { path: string; url: URL; init?: RequestInit }[] } {
  const calls: { path: string; url: URL; init?: RequestInit }[] = []
  vi.stubGlobal(
    'fetch',
    vi.fn(async (input: URL, init?: RequestInit) => {
      const url = input instanceof URL ? input : new URL(String(input))
      calls.push({ path: url.pathname, url, init })
      if (url.pathname === '/api/get') {
        if (!routes.get) throw new TypeError('unexpected /api/get')
        return routes.get()
      }
      if (url.pathname === '/api/search') {
        if (!routes.search) throw new TypeError('unexpected /api/search')
        return routes.search()
      }
      throw new TypeError(`unrouted ${url.pathname}`)
    })
  )
  return { calls }
}

const run = (): Promise<ReturnType<typeof lrclibProvider.lookup>> =>
  lrclibProvider.lookup(QUERY, new AbortController().signal)

beforeEach(() => vi.spyOn(console, 'error').mockImplementation(() => {}))
afterEach(() => vi.unstubAllGlobals())

describe('lrclibProvider — exact match', () => {
  it('returns synced lyrics without searching', async () => {
    const { calls } = route({ get: () => json(track()) })
    const outcome = await run()
    expect(outcome).toEqual({
      kind: 'lyrics',
      lines: [
        { timeMs: 1000, text: 'Is this the real life' },
        { timeMs: 4500, text: 'Is this just fantasy' }
      ]
    })
    expect(calls.map((c) => c.path)).toEqual(['/api/get'])
  })

  it('sends a User-Agent', async () => {
    const { calls } = route({ get: () => json(track()) })
    await run()
    const headers = calls[0]?.init?.headers as Record<string, string>
    expect(headers['User-Agent']).toMatch(/^Linea\/9\.9\.9 /)
  })

  it('treats the instrumental flag as authoritative and never searches', async () => {
    const { calls } = route({ get: () => json(track({ instrumental: true, syncedLyrics: null })) })
    expect(await run()).toEqual({ kind: 'instrumental' })
    expect(calls.map((c) => c.path)).toEqual(['/api/get'])
  })

  it('passes the query through as exact parameters', async () => {
    const { calls } = route({ get: () => json(track()) })
    await run()
    const url = calls[0]!.url
    expect(url.searchParams.get('track_name')).toBe('Bohemian Rhapsody')
    expect(url.searchParams.get('duration')).toBe('354')
  })
})

describe('lrclibProvider — fuzzy fallback', () => {
  // The headline coverage win: LRCLIB has the track but its duration differs
  // from Spotify's, so the exact lookup 404s.
  it('recovers a 404 through search', async () => {
    const { calls } = route({
      get: () => json({}, 404),
      search: () => json([track({ duration: 349 })])
    })
    const outcome = await run()
    expect(outcome.kind).toBe('lyrics')
    expect(calls.map((c) => c.path)).toEqual(['/api/get', '/api/search'])
  })

  // Second coverage win: previously this stopped the search entirely.
  it('searches on when the exact hit has only plain lyrics', async () => {
    const { calls } = route({
      get: () => json(track({ syncedLyrics: null })),
      search: () => json([track({ duration: 351 })])
    })
    expect((await run()).kind).toBe('lyrics')
    expect(calls.map((c) => c.path)).toEqual(['/api/get', '/api/search'])
  })

  it('still searches after a server error on the exact endpoint', async () => {
    const { calls } = route({ get: () => json({}, 503), search: () => json([track()]) })
    expect((await run()).kind).toBe('lyrics')
    expect(calls.map((c) => c.path)).toEqual(['/api/get', '/api/search'])
  })

  it('retries with a broad query when the structured search is empty', async () => {
    let call = 0
    const { calls } = route({
      get: () => json({}, 404),
      search: () => (call++ === 0 ? json([]) : json([track()]))
    })
    expect((await run()).kind).toBe('lyrics')
    expect(calls.filter((c) => c.path === '/api/search')).toHaveLength(2)
    expect(calls[1]!.url.searchParams.get('track_name')).toBe('Bohemian Rhapsody')
    expect(calls[2]!.url.searchParams.get('q')).toBe('Queen Bohemian Rhapsody')
  })

  it('reports no-match when search returns nothing', async () => {
    route({ get: () => json({}, 404), search: () => json([]) })
    expect(await run()).toEqual({ kind: 'no-match' })
  })

  it('rejects candidates that do not clear the threshold', async () => {
    route({
      get: () => json({}, 404),
      search: () => json([track({ trackName: 'Radio Ga Ga', duration: 348 })])
    })
    expect(await run()).toEqual({ kind: 'no-match' })
  })

  it('ignores search hits that only have plain lyrics', async () => {
    route({ get: () => json({}, 404), search: () => json([track({ syncedLyrics: null })]) })
    expect(await run()).toEqual({ kind: 'no-match' })
  })

  it('picks the closest duration among several valid hits', async () => {
    route({
      get: () => json({}, 404),
      search: () =>
        json([
          track({ duration: 344, syncedLyrics: '[00:09.00]far' }),
          track({ duration: 355, syncedLyrics: '[00:07.00]near' })
        ])
    })
    const outcome = await run()
    expect(outcome.kind === 'lyrics' && outcome.lines[0]?.text).toBe('near')
  })
})

describe('lrclibProvider — reachability', () => {
  it('reports unreachable and does not search when the connection fails', async () => {
    const { calls } = route({
      get: () => {
        throw new TypeError('fetch failed')
      }
    })
    expect(await run()).toEqual({ kind: 'unreachable' })
    expect(calls.map((c) => c.path)).toEqual(['/api/get'])
  })

  it('reports unreachable when the search connection fails', async () => {
    route({
      get: () => json({}, 404),
      search: () => {
        throw new TypeError('fetch failed')
      }
    })
    expect(await run()).toEqual({ kind: 'unreachable' })
  })

  it('survives a malformed body without throwing', async () => {
    route({ get: () => new Response('<html>blocked</html>', { status: 200 }), search: () => json([]) })
    expect(await run()).toEqual({ kind: 'no-match' })
  })
})
