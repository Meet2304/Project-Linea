import { app } from 'electron'
import { join } from 'node:path'
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs'
import { parseLrc, type LyricLine, type LyricsResult } from '../shared/lyrics'

interface LrcLibResponse {
  syncedLyrics?: string | null
}

/**
 * lrclib asks clients to identify themselves, and fronts the API with a WAF
 * that drops requests it cannot attribute. Without this header the request
 * carries the runtime's default agent, which is exactly the traffic that gets
 * dropped — and the failure looks identical to "this track has no lyrics".
 */
const USER_AGENT = `Linea/${app.getVersion()} (https://github.com/Meet2304/Project-Linea)`

// Spotify track IDs are base62. The ID becomes a filename, so reject
// anything else — a hostile value like "../.." must never reach join().
const TRACK_ID_RE = /^[A-Za-z0-9]{1,64}$/

const cacheDir = (): string => join(app.getPath('userData'), 'lyrics-cache')
const cacheFile = (trackId: string): string => join(cacheDir(), `${trackId}.json`)

function readCached(trackId: string): LyricLine[] | null {
  if (!existsSync(cacheFile(trackId))) return null
  try {
    const parsed = JSON.parse(readFileSync(cacheFile(trackId), 'utf-8')) as unknown
    return Array.isArray(parsed) ? (parsed as LyricLine[]) : null
  } catch {
    // Corrupt cache entry — fall through to a fresh fetch.
    return null
  }
}

/**
 * Distinguishes "this track has no synced lyrics" from "we never reached
 * lrclib". Both used to return an empty array, so a blocked or unreachable
 * API was reported to the user as a confident statement about the track —
 * which is both wrong and impossible to act on.
 */
export async function getLyricsForTrack(params: {
  trackId: string
  trackName: string
  artistName: string
  albumName: string
  durationSec: number
}): Promise<LyricsResult> {
  if (!TRACK_ID_RE.test(params.trackId)) return { lines: [], status: 'none' }

  const cached = readCached(params.trackId)
  if (cached) return { lines: cached, status: 'ok' }

  const url = new URL('https://lrclib.net/api/get')
  url.searchParams.set('track_name', params.trackName)
  url.searchParams.set('artist_name', params.artistName)
  url.searchParams.set('album_name', params.albumName)
  url.searchParams.set('duration', String(params.durationSec))

  let lines: LyricLine[]
  try {
    const response = await fetch(url, {
      headers: { 'User-Agent': USER_AGENT },
      signal: AbortSignal.timeout(10_000)
    })
    // 404 is lrclib's "no match for this track" — the only response that
    // genuinely says the track has no lyrics. Anything else is the service
    // failing us, not an answer about the track.
    if (response.status === 404) return { lines: [], status: 'none' }
    if (!response.ok) {
      console.error(`Lyrics lookup failed: lrclib returned ${response.status}`)
      return { lines: [], status: 'unreachable' }
    }
    const data = (await response.json()) as LrcLibResponse
    lines = data.syncedLyrics ? parseLrc(data.syncedLyrics) : []
  } catch (error) {
    // DNS, TLS, timeout, or a network-level block on lrclib.net. Report it
    // as such: the user can act on "can't reach the service", but not on a
    // false claim that the track has no lyrics.
    console.error('Lyrics lookup could not reach lrclib.net:', error)
    return { lines: [], status: 'unreachable' }
  }

  // Only cache non-empty results so a transient miss isn't sticky forever.
  if (lines.length > 0) {
    try {
      mkdirSync(cacheDir(), { recursive: true })
      writeFileSync(cacheFile(params.trackId), JSON.stringify(lines))
    } catch (error) {
      console.error('Failed to write lyrics cache:', error)
    }
  }

  return { lines, status: lines.length > 0 ? 'ok' : 'none' }
}
