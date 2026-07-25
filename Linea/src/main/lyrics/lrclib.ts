import { parseLrc } from '../../shared/lyrics'
import { fetchJson } from './http'
import { pickBest, type Candidate } from './match'
import type { LyricsProvider, LyricsQuery, ProviderOutcome } from './types'

/**
 * LRCLIB — the primary source. Open, community-run, purpose-built for this.
 *
 * `/api/get` is an *exact* match including duration, and LRCLIB entries
 * routinely differ from Spotify's duration by several seconds, so it 404s on
 * tracks that are sitting right there in the database. The `/api/search`
 * fallback is where most of the recovered coverage comes from.
 */

const BASE = 'https://lrclib.net'
const GET_TIMEOUT_MS = 5_000
const SEARCH_TIMEOUT_MS = 5_000
/** LRCLIB is a lyrics-first database over the same catalogue Spotify uses. */
const MIN_SCORE = 0.72
const MAX_CANDIDATES = 20

interface LrcLibTrack {
  trackName?: string
  artistName?: string
  albumName?: string
  duration?: number
  instrumental?: boolean
  plainLyrics?: string | null
  syncedLyrics?: string | null
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

function asTrack(value: unknown): LrcLibTrack | null {
  return isRecord(value) ? (value as LrcLibTrack) : null
}

function toCandidate(track: LrcLibTrack): Candidate {
  return {
    trackName: track.trackName ?? '',
    artistName: track.artistName ?? '',
    albumName: track.albumName,
    durationSec: typeof track.duration === 'number' ? track.duration : 0,
    hasSynced: typeof track.syncedLyrics === 'string' && track.syncedLyrics.length > 0,
    instrumental: track.instrumental === true
  }
}

/** `try-search` means the exact lookup settled nothing — go fuzzy. */
type ExactResult = ProviderOutcome | { kind: 'try-search' }

async function exactGet(query: LyricsQuery, signal: AbortSignal): Promise<ExactResult> {
  const url = new URL('/api/get', BASE)
  url.searchParams.set('track_name', query.trackName)
  url.searchParams.set('artist_name', query.artistName)
  url.searchParams.set('album_name', query.albumName)
  url.searchParams.set('duration', String(query.durationSec))

  const response = await fetchJson(url, { signal, timeoutMs: GET_TIMEOUT_MS })
  // A dead host stays dead — do not spend the search budget confirming it.
  if (response.kind === 'transport') return { kind: 'unreachable' }
  // 404 means "no exact match", not "no lyrics". A 5xx is a server hiccup on
  // one endpoint. Either way the fuzzy search still has a real chance.
  if (response.kind === 'http') return { kind: 'try-search' }

  const track = asTrack(response.body)
  if (!track) return { kind: 'try-search' }
  // On the exact-match path this flag is authoritative: no source has lyrics
  // for a track that has none.
  if (track.instrumental === true) return { kind: 'instrumental' }
  if (typeof track.syncedLyrics === 'string' && track.syncedLyrics.length > 0) {
    return { kind: 'lyrics', lines: parseLrc(track.syncedLyrics) }
  }
  // Plain-only is not a verdict under synced-only: another provider may have
  // a properly timed version, so keep looking.
  return { kind: 'try-search' }
}

async function search(
  params: Record<string, string>,
  signal: AbortSignal
): Promise<LrcLibTrack[] | 'unreachable'> {
  const url = new URL('/api/search', BASE)
  for (const [key, value] of Object.entries(params)) url.searchParams.set(key, value)

  const response = await fetchJson(url, { signal, timeoutMs: SEARCH_TIMEOUT_MS })
  if (response.kind === 'transport') return 'unreachable'
  if (response.kind === 'http') return response.status === 404 ? [] : 'unreachable'
  if (!Array.isArray(response.body)) return []
  return response.body.slice(0, MAX_CANDIDATES).map(asTrack).filter((t): t is LrcLibTrack => !!t)
}

async function fuzzySearch(query: LyricsQuery, signal: AbortSignal): Promise<ProviderOutcome> {
  // Structured first (higher precision), then one broader free-text retry.
  let tracks = await search(
    { track_name: query.trackName, artist_name: query.artistName },
    signal
  )
  if (tracks === 'unreachable') return { kind: 'unreachable' }

  if (tracks.length === 0) {
    const retry = await search({ q: `${query.artistName} ${query.trackName}` }, signal)
    if (retry === 'unreachable') return { kind: 'unreachable' }
    tracks = retry
  }
  if (tracks.length === 0) return { kind: 'no-match' }

  const candidates = tracks.map(toCandidate)
  const best = pickBest(candidates, query, MIN_SCORE)
  if (!best) return { kind: 'no-match' }

  const track = tracks[best.index]
  const synced = track?.syncedLyrics
  if (typeof synced !== 'string' || synced.length === 0) return { kind: 'no-match' }
  return { kind: 'lyrics', lines: parseLrc(synced) }
}

export const lrclibProvider: LyricsProvider = {
  id: 'lrclib',
  async lookup(query, signal) {
    const exact = await exactGet(query, signal)
    if (exact.kind !== 'try-search') return exact
    return fuzzySearch(query, signal)
  }
}
