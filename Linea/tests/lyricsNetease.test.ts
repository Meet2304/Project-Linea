import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

vi.mock('electron', () => ({ app: { getVersion: () => '9.9.9' } }))

const { neteaseProvider } = await import('../src/main/lyrics/netease')
import type { LyricsQuery } from '../src/main/lyrics/types'

const QUERY: LyricsQuery = {
  trackName: 'Bohemian Rhapsody',
  artistName: 'Queen',
  albumName: 'A Night at the Opera',
  durationSec: 354
}

/**
 * Shapes below are trimmed from real responses captured against
 * music.163.com, so a change in NetEase's contract shows up as a test failure
 * rather than as silence in the panel.
 */
const song = (over: Record<string, unknown> = {}): Record<string, unknown> => ({
  id: 1318816004,
  name: 'Bohemian Rhapsody',
  duration: 354947,
  artists: [{ id: 41906, name: 'Queen' }],
  album: { id: 73977486, name: 'Bohemian Rhapsody (The Original Soundtrack)' },
  ...over
})

const LYRIC_TEXT =
  '[00:00.00] 作词 : Freddie Mercury\n' +
  '[00:00.17] 作曲 : Freddie Mercury\n' +
  '[00:00.35]Is this the real life?\n' +
  '[00:03.79]Is this just fantasy?'

const json = (body: unknown, status = 200): Response =>
  new Response(JSON.stringify(body), { status })

interface Routes {
  search?: () => Response | Promise<Response>
  lyric?: () => Response | Promise<Response>
}

function route(routes: Routes): { calls: { path: string; url: URL; init?: RequestInit }[] } {
  const calls: { path: string; url: URL; init?: RequestInit }[] = []
  vi.stubGlobal(
    'fetch',
    vi.fn(async (input: URL, init?: RequestInit) => {
      const url = input instanceof URL ? input : new URL(String(input))
      calls.push({ path: url.pathname, url, init })
      if (url.pathname === '/api/search/get') {
        if (!routes.search) throw new TypeError('unexpected search')
        return routes.search()
      }
      if (url.pathname === '/api/song/lyric') {
        if (!routes.lyric) throw new TypeError('unexpected lyric')
        return routes.lyric()
      }
      throw new TypeError(`unrouted ${url.pathname}`)
    })
  )
  return { calls }
}

const run = (): Promise<ReturnType<typeof neteaseProvider.lookup>> =>
  neteaseProvider.lookup(QUERY, new AbortController().signal)

beforeEach(() => vi.spyOn(console, 'error').mockImplementation(() => {}))
afterEach(() => vi.unstubAllGlobals())

describe('neteaseProvider', () => {
  it('returns synced lyrics for a confident match', async () => {
    route({
      search: () => json({ result: { songs: [song()] } }),
      lyric: () => json({ code: 200, lrc: { version: 3, lyric: LYRIC_TEXT } })
    })
    const outcome = await run()
    expect(outcome).toEqual({
      kind: 'lyrics',
      lines: [
        { timeMs: 350, text: 'Is this the real life?' },
        { timeMs: 3790, text: 'Is this just fantasy?' }
      ]
    })
  })

  it('sends the Referer NetEase expects, plus a User-Agent', async () => {
    const { calls } = route({
      search: () => json({ result: { songs: [song()] } }),
      lyric: () => json({ code: 200, lrc: { lyric: LYRIC_TEXT } })
    })
    await run()
    const headers = calls[0]?.init?.headers as Record<string, string>
    expect(headers['Referer']).toBe('https://music.163.com/')
    expect(headers['User-Agent']).toMatch(/^Linea\/9\.9\.9 /)
  })

  it('requests the lyric by the matched song id', async () => {
    const { calls } = route({
      search: () => json({ result: { songs: [song({ id: 42 })] } }),
      lyric: () => json({ code: 200, lrc: { lyric: LYRIC_TEXT } })
    })
    await run()
    expect(calls[1]?.url.searchParams.get('id')).toBe('42')
  })

  // NetEase answers nonsense queries with real tracks, so the duration
  // ceiling is what stops the wrong lyrics from being rendered.
  it('rejects a confident-looking hit whose duration is too far off', async () => {
    const { calls } = route({ search: () => json({ result: { songs: [song({ duration: 300_000 })] } }) })
    expect(await run()).toEqual({ kind: 'no-match' })
    expect(calls).toHaveLength(1) // never bothered fetching the lyric
  })

  it('rejects an unrelated track returned for a loose query', async () => {
    route({
      search: () => json({ result: { songs: [song({ name: 'Fever Pt.2', artists: [{ name: 'ZXXXQ' }] })] } })
    })
    expect(await run()).toEqual({ kind: 'no-match' })
  })

  it('rejects a karaoke entry', async () => {
    route({
      search: () => json({ result: { songs: [song({ name: 'Bohemian Rhapsody (Karaoke)' })] } })
    })
    expect(await run()).toEqual({ kind: 'no-match' })
  })

  it('reports no-match when the track has no collected lyrics', async () => {
    route({
      search: () => json({ result: { songs: [song()] } }),
      lyric: () => json({ code: 200, uncollected: true, lrc: { lyric: '' } })
    })
    expect(await run()).toEqual({ kind: 'no-match' })
  })

  it('reports no-match for the nolyric flag', async () => {
    route({
      search: () => json({ result: { songs: [song()] } }),
      lyric: () => json({ code: 200, nolyric: true })
    })
    expect(await run()).toEqual({ kind: 'no-match' })
  })

  it('reports no-match when the lyric text carries no usable timings', async () => {
    route({
      search: () => json({ result: { songs: [song()] } }),
      lyric: () => json({ code: 200, lrc: { lyric: 'Is this the real life?\nIs this just fantasy?' } })
    })
    expect(await run()).toEqual({ kind: 'no-match' })
  })

  it('reports no-match when search returns no songs', async () => {
    route({ search: () => json({ result: { songs: [] } }) })
    expect(await run()).toEqual({ kind: 'no-match' })
  })

  it('reports unreachable when the connection fails', async () => {
    route({
      search: () => {
        throw new TypeError('fetch failed')
      }
    })
    expect(await run()).toEqual({ kind: 'unreachable' })
  })

  it('reports unreachable when the lyric fetch fails', async () => {
    route({
      search: () => json({ result: { songs: [song()] } }),
      lyric: () => {
        throw new TypeError('fetch failed')
      }
    })
    expect(await run()).toEqual({ kind: 'unreachable' })
  })

  it('survives an unexpected body shape', async () => {
    route({ search: () => json({ code: 400 }) })
    expect(await run()).toEqual({ kind: 'no-match' })
  })
})
