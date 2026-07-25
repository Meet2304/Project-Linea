import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

vi.mock('electron', () => ({
  app: { getPath: () => '/tmp/linea-lyrics-test', getVersion: () => '9.9.9' }
}))

vi.mock('node:fs', async (importOriginal) => {
  const actual = await importOriginal<typeof import('node:fs')>()
  const store = new Map<string, string>()
  return {
    ...actual,
    existsSync: (p: string) => store.has(p),
    readFileSync: (p: string) => store.get(p)!,
    writeFileSync: (p: string, data: string) => {
      store.set(p, String(data))
    },
    mkdirSync: () => undefined,
    __store: store
  }
})

const { getLyricsForTrack } = await import('../src/main/lyricsCache')

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

const SYNCED = '[00:01.00]Is this the real life\n[00:04.50]Is this just fantasy'

describe('getLyricsForTrack', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
    // Silence the deliberate console.error on failure paths.
    vi.spyOn(console, 'error').mockImplementation(() => {})
  })

  afterEach(() => vi.unstubAllGlobals())

  it('parses synced lyrics into lines', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response(JSON.stringify({ syncedLyrics: SYNCED }), { status: 200 }))
    )
    const result = await getLyricsForTrack(freshTrack())
    expect(result.status).toBe('ok')
    expect(result.lines).toHaveLength(2)
    expect(result.lines[0]).toEqual({ timeMs: 1000, text: 'Is this the real life' })
  })

  it('identifies itself so lrclib does not drop the request', async () => {
    const fetchMock = vi.fn(
      async () => new Response(JSON.stringify({ syncedLyrics: SYNCED }), { status: 200 })
    )
    vi.stubGlobal('fetch', fetchMock)
    await getLyricsForTrack(freshTrack())

    const init = fetchMock.mock.calls[0]?.[1] as RequestInit
    const ua = (init.headers as Record<string, string>)['User-Agent']
    expect(ua).toMatch(/^Linea\/9\.9\.9 /)
  })

  it("reports 'none' when lrclib says it has no match", async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response('', { status: 404 })))
    const result = await getLyricsForTrack(freshTrack())
    expect(result).toEqual({ lines: [], status: 'none' })
  })

  it("reports 'none' when the track exists but has no synced lyrics", async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response(JSON.stringify({ syncedLyrics: null }), { status: 200 }))
    )
    const result = await getLyricsForTrack(freshTrack())
    expect(result).toEqual({ lines: [], status: 'none' })
  })

  // The bug this guards: a blocked or unreachable lrclib used to be reported
  // as a confident "this track has no lyrics".
  it("reports 'unreachable' when the connection fails", async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => {
        throw new TypeError('fetch failed')
      })
    )
    const result = await getLyricsForTrack(freshTrack())
    expect(result).toEqual({ lines: [], status: 'unreachable' })
  })

  it("reports 'unreachable' on a server error rather than blaming the track", async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response('', { status: 503 })))
    const result = await getLyricsForTrack(freshTrack())
    expect(result).toEqual({ lines: [], status: 'unreachable' })
  })

  it('rejects a track id that is not base62, without hitting the network', async () => {
    const fetchMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock)
    const result = await getLyricsForTrack({ ...TRACK, trackId: '../../etc/passwd' })
    expect(result).toEqual({ lines: [], status: 'none' })
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('serves a cached hit without refetching', async () => {
    const track = freshTrack()
    const fetchMock = vi.fn(
      async () => new Response(JSON.stringify({ syncedLyrics: SYNCED }), { status: 200 })
    )
    vi.stubGlobal('fetch', fetchMock)

    await getLyricsForTrack(track)
    const second = await getLyricsForTrack(track)

    expect(fetchMock).toHaveBeenCalledTimes(1)
    expect(second.status).toBe('ok')
    expect(second.lines).toHaveLength(2)
  })
})
