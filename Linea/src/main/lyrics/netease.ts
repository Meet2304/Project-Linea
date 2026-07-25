import { parseLrc } from '../../shared/lyrics'
import { fetchJson } from './http'
import { pickBest, type Candidate } from './match'
import type { LyricsProvider, LyricsQuery, ProviderOutcome } from './types'

/**
 * NetEase Cloud Music — the fallback source, on a different domain to LRCLIB
 * so that one blocked or dead host cannot take lyrics down entirely.
 *
 * This is an unofficial endpoint with no stability contract, which shapes
 * every decision here: it sits last in the chain, every field is parsed
 * defensively, and any surprise degrades to `no-match` rather than throwing.
 *
 * Its search is also extremely loose — it answers a nonsense query like
 * "zzzqqqxxxnonexistent" with a real, confident track. That is why the
 * acceptance bar below is far stricter than LRCLIB's: a wrong lyric scrolling
 * against the song is worse than no lyric at all.
 */

const BASE = 'https://music.163.com'
const SEARCH_TIMEOUT_MS = 4_000
const LYRIC_TIMEOUT_MS = 4_000
const SEARCH_LIMIT = 10

const MIN_SCORE = 0.8
/** A hard ceiling on top of the score — the real defence against loose search. */
const MAX_DURATION_DELTA_SEC = 5

/** NetEase rejects or degrades requests that do not look like they came from its site. */
const HEADERS = { Referer: `${BASE}/` }

interface NeteaseSong {
  id?: number
  name?: string
  /** Milliseconds. */
  duration?: number
  artists?: { name?: string }[]
  album?: { name?: string }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

function toCandidate(song: NeteaseSong): Candidate {
  return {
    trackName: song.name ?? '',
    artistName: (song.artists ?? []).map((a) => a?.name ?? '').filter(Boolean).join(', '),
    albumName: song.album?.name,
    durationSec: typeof song.duration === 'number' ? Math.round(song.duration / 1000) : 0,
    // The search endpoint never says whether lyrics exist; that is only known
    // after fetching them, so every candidate is provisionally eligible.
    hasSynced: true
  }
}

async function search(
  query: LyricsQuery,
  signal: AbortSignal
): Promise<NeteaseSong[] | 'unreachable'> {
  const url = new URL('/api/search/get', BASE)
  url.searchParams.set('s', `${query.trackName} ${query.artistName}`)
  url.searchParams.set('type', '1')
  url.searchParams.set('limit', String(SEARCH_LIMIT))
  url.searchParams.set('offset', '0')

  const response = await fetchJson(url, { signal, timeoutMs: SEARCH_TIMEOUT_MS, headers: HEADERS })
  if (response.kind === 'transport') return 'unreachable'
  if (response.kind === 'http') return 'unreachable'

  if (!isRecord(response.body)) return []
  const result = response.body.result
  if (!isRecord(result) || !Array.isArray(result.songs)) return []
  return result.songs.filter(isRecord) as NeteaseSong[]
}

async function fetchLyric(id: number, signal: AbortSignal): Promise<string | null | 'unreachable'> {
  const url = new URL('/api/song/lyric', BASE)
  url.searchParams.set('id', String(id))
  url.searchParams.set('lv', '1')
  url.searchParams.set('kv', '1')
  url.searchParams.set('tv', '-1')

  const response = await fetchJson(url, { signal, timeoutMs: LYRIC_TIMEOUT_MS, headers: HEADERS })
  if (response.kind === 'transport' || response.kind === 'http') return 'unreachable'
  if (!isRecord(response.body)) return null

  // `uncollected` and `nolyric` are how NetEase says "this track has none".
  if (response.body.uncollected === true || response.body.nolyric === true) return null

  const lrc = response.body.lrc
  if (!isRecord(lrc) || typeof lrc.lyric !== 'string') return null
  return lrc.lyric
}

export const neteaseProvider: LyricsProvider = {
  id: 'netease',
  async lookup(query, signal): Promise<ProviderOutcome> {
    const songs = await search(query, signal)
    if (songs === 'unreachable') return { kind: 'unreachable' }
    if (songs.length === 0) return { kind: 'no-match' }

    const best = pickBest(songs.map(toCandidate), query, MIN_SCORE, MAX_DURATION_DELTA_SEC)
    if (!best) return { kind: 'no-match' }

    const id = songs[best.index]?.id
    if (typeof id !== 'number') return { kind: 'no-match' }

    const lyric = await fetchLyric(id, signal)
    if (lyric === 'unreachable') return { kind: 'unreachable' }
    if (lyric === null || lyric.length === 0) return { kind: 'no-match' }

    const lines = parseLrc(lyric)
    // NetEase stores plenty of unsynced lyrics in the same field, which parse
    // to nothing (or to a single zero cue). Linea is a synced overlay, so
    // treat that as no match and let the panel say so honestly.
    if (lines.length < 2) return { kind: 'no-match' }
    return { kind: 'lyrics', lines }
  }
}
