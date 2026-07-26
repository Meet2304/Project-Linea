import { NextResponse } from 'next/server'
import { DEMO_TRACK, parseLrc, type LyricLine } from '@/components/demo/lyrics'

/**
 * Fetches a track's synced lyrics at request time.
 *
 * Deliberately *not* committed to the repo. Song lyrics are copyrighted, and
 * checking a full set into a public repository — then serving them from our
 * own origin as page content — is redistribution. This route does what the
 * desktop app does: asks for them on demand and stores nothing.
 *
 * With no query it answers for the homepage demo track. The changelog passes
 * `?track=&artist=`, because each dispatch carries the song that was playing
 * when that release was built.
 *
 * PROVIDER CHAIN
 * The same shape as Linea/src/main/lyrics/chain.ts, and for the same reason.
 * LRCLIB is routinely blocked at the network level — ISP content filtering
 * intercepts the TLS handshake by SNI, which surfaces here as
 * ERR_SSL_PACKET_LENGTH_TOO_LONG rather than a clean failure. That is the
 * whole subject of the 0.1.3 notes, and 0.1.4 fixed it in the app by adding a
 * second source on a different domain. The website had never caught up; this
 * is that fix, ported.
 *
 * NetEase sits second and is held to a much stricter matching bar, because
 * its search is loose enough to answer nonsense confidently — and the wrong
 * words scrolling against a song are worse than none.
 *
 * Nothing here ever throws: a caller gets `lines: null` and keeps its own
 * fallback copy, which is what 0.1.3 taught us to do.
 */

const REVALIDATE_SECONDS = 86_400
const TIMEOUT_MS = 5_000
const UA = 'Linea Website (https://github.com/Meet2304/Project-Linea)'

interface Found {
  lines: LyricLine[]
  durationMs?: number
}

/** Fetch JSON, degrading every possible failure to null. */
async function json(url: string, headers: Record<string, string> = {}): Promise<unknown> {
  try {
    const res = await fetch(url, {
      headers: { 'User-Agent': UA, ...headers },
      signal: AbortSignal.timeout(TIMEOUT_MS),
      // Cached at the CDN via Cache-Control below. Keeping the data cache out
      // of it means a transport error is ours to catch, not Next's to raise
      // while piping the response.
      cache: 'no-store'
    })
    if (!res.ok) return null
    return await res.json()
  } catch {
    return null
  }
}

const isRecord = (v: unknown): v is Record<string, unknown> =>
  typeof v === 'object' && v !== null

/** Loose comparison key: case, punctuation and bracketed suffixes removed. */
function norm(s: string): string {
  return s
    .toLowerCase()
    .replace(/\((?:feat|ft|with)[^)]*\)/g, '')
    .replace(/[[(].*?[\])]/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
}

/* --- 1. LRCLIB ---------------------------------------------------------- */

async function fromLrclib(track: string, artist: string): Promise<Found | null> {
  const params = new URLSearchParams({ track_name: track, artist_name: artist })

  const exact = (await json(`https://lrclib.net/api/get?${params}`)) as {
    syncedLyrics?: string
    duration?: number
  } | null

  let synced = exact?.syncedLyrics
  let duration = exact?.duration

  // The exact lookup matches on duration and misses often — the same problem
  // 0.1.4 fixed in the app. Fall back to a search.
  if (!synced) {
    const hits = (await json(`https://lrclib.net/api/search?${params}`)) as
      | { syncedLyrics?: string; duration?: number }[]
      | null
    const hit = Array.isArray(hits) ? hits.find((h) => h?.syncedLyrics) : undefined
    if (hit) {
      synced = hit.syncedLyrics
      duration = hit.duration
    }
  }

  if (!synced) return null
  const lines = parseLrc(synced)
  if (lines.length <= 2) return null
  return { lines, durationMs: duration ? Math.round(duration * 1000) : undefined }
}

/* --- 2. NetEase --------------------------------------------------------- */

interface NeteaseSong {
  id?: number
  name?: string
  duration?: number
  artists?: { name?: string }[]
}

async function fromNetease(track: string, artist: string): Promise<Found | null> {
  const base = 'https://music.163.com'
  // NetEase degrades requests that do not look like they came from its site.
  const headers = { Referer: `${base}/` }

  const search = new URL('/api/search/get', base)
  search.searchParams.set('s', `${track} ${artist}`)
  search.searchParams.set('type', '1')
  search.searchParams.set('limit', '10')
  search.searchParams.set('offset', '0')

  const body = await json(search.toString(), headers)
  if (!isRecord(body) || !isRecord(body.result) || !Array.isArray(body.result.songs)) return null

  const songs = (body.result.songs as unknown[]).filter(isRecord) as NeteaseSong[]

  // The strict bar. NetEase will answer a nonsense query with a real, confident
  // track, so the title has to actually match and the artist has to appear.
  const wantTrack = norm(track)
  const wantArtist = norm(artist)
  const best = songs.find((s) => {
    const name = norm(s.name ?? '')
    if (!name || (name !== wantTrack && !name.startsWith(wantTrack))) return false
    const artists = norm((s.artists ?? []).map((a) => a?.name ?? '').join(' '))
    return artists.includes(wantArtist) || wantArtist.includes(artists)
  })

  if (!best || typeof best.id !== 'number') return null

  const lyric = new URL('/api/song/lyric', base)
  lyric.searchParams.set('id', String(best.id))
  lyric.searchParams.set('lv', '1')
  lyric.searchParams.set('kv', '1')
  lyric.searchParams.set('tv', '-1')

  const got = await json(lyric.toString(), headers)
  if (!isRecord(got)) return null
  if (got.uncollected === true || got.nolyric === true) return null
  if (!isRecord(got.lrc) || typeof got.lrc.lyric !== 'string') return null

  // NetEase keeps plenty of unsynced lyrics in the same field; those parse to
  // nothing useful, and Linea is a synced overlay.
  const lines = parseLrc(got.lrc.lyric)
  if (lines.length <= 2) return null

  return {
    lines,
    durationMs: typeof best.duration === 'number' ? best.duration : undefined
  }
}

/* --- route -------------------------------------------------------------- */

export async function GET(request: Request) {
  const q = new URL(request.url).searchParams
  const track = q.get('track')?.trim() || DEMO_TRACK.title
  const artist = q.get('artist')?.trim() || DEMO_TRACK.artist

  let found: Found | null = null
  let source: string | null = null

  for (const [id, provider] of [
    ['lrclib', fromLrclib],
    ['netease', fromNetease]
  ] as const) {
    try {
      found = await provider(track, artist)
    } catch {
      found = null
    }
    if (found) {
      source = id
      break
    }
  }

  return NextResponse.json(
    {
      lines: found?.lines ?? null,
      durationMs: found?.durationMs,
      source
    },
    {
      headers: {
        // Only cache a hit. A miss is usually a blocked network, and that
        // should not be pinned for a day.
        'Cache-Control': found
          ? `public, s-maxage=${REVALIDATE_SECONDS}, stale-while-revalidate=604800`
          : 'no-store'
      }
    }
  )
}
