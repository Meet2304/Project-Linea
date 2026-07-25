import { app } from 'electron'
import { join } from 'node:path'
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs'
import type { LyricLine, LyricsResult } from '../shared/lyrics'
import { resolveLyrics } from './lyrics/chain'
import { lrclibProvider } from './lyrics/lrclib'
import { neteaseProvider } from './lyrics/netease'
import type { LyricsProvider, ProviderId } from './lyrics/types'

/**
 * Lyrics lookup: disk cache, then a chain of providers.
 *
 * Order matters — LRCLIB is open, purpose-built and authoritative, so it goes
 * first. NetEase is an unofficial endpoint kept as a fallback so that a single
 * dead or blocked host cannot take lyrics down entirely (issue #25).
 */
export const DEFAULT_PROVIDERS: readonly LyricsProvider[] = [lrclibProvider, neteaseProvider]

// Spotify track IDs are base62. The ID becomes a filename, so reject
// anything else — a hostile value like "../.." must never reach join().
const TRACK_ID_RE = /^[A-Za-z0-9]{1,64}$/

const cacheDir = (): string => join(app.getPath('userData'), 'lyrics-cache')
const cacheFile = (trackId: string): string => join(cacheDir(), `${trackId}.json`)

interface CacheFileV2 {
  v: 2
  provider: ProviderId
  fetchedAt: number
  lines: LyricLine[]
}

/**
 * Reads both the current envelope and the bare `LyricLine[]` written by
 * earlier versions. Legacy files are served as-is and never rewritten — a
 * cached positive result is still correct, so migrating them would be churn
 * for no gain.
 */
function readCached(trackId: string): LyricLine[] | null {
  if (!existsSync(cacheFile(trackId))) return null
  try {
    const parsed = JSON.parse(readFileSync(cacheFile(trackId), 'utf-8')) as unknown
    if (Array.isArray(parsed)) return parsed as LyricLine[]
    if (
      typeof parsed === 'object' &&
      parsed !== null &&
      (parsed as CacheFileV2).v === 2 &&
      Array.isArray((parsed as CacheFileV2).lines)
    ) {
      return (parsed as CacheFileV2).lines
    }
    return null
  } catch {
    // Corrupt cache entry — fall through to a fresh fetch.
    return null
  }
}

function writeCache(trackId: string, lines: LyricLine[], provider: ProviderId): void {
  const payload: CacheFileV2 = { v: 2, provider, fetchedAt: Date.now(), lines }
  try {
    mkdirSync(cacheDir(), { recursive: true })
    writeFileSync(cacheFile(trackId), JSON.stringify(payload))
  } catch (error) {
    console.error('Failed to write lyrics cache:', error)
  }
}

// ------------------------------------------------------------------
// Negative cache — in memory only, deliberately.
//
// Persisting a miss would be actively harmful: a `none` recorded while the
// network was blocking lyrics would outlive the outage and make it permanent
// across restarts. That is the exact failure this whole feature exists to fix.
// ------------------------------------------------------------------
const NONE_TTL_MS = 30 * 60_000
/** Short, so recovery is quick — this only exists to stop a hammering loop. */
const UNREACHABLE_TTL_MS = 60_000

const negativeCache = new Map<string, { status: 'none' | 'unreachable'; expiresAt: number }>()

function readNegative(trackId: string, now: number): LyricsResult | null {
  const entry = negativeCache.get(trackId)
  if (!entry) return null
  if (entry.expiresAt <= now) {
    negativeCache.delete(trackId)
    return null
  }
  return { lines: [], status: entry.status }
}

/** Test seam — the negative cache is process-wide by design. */
export function resetNegativeCache(): void {
  negativeCache.clear()
}

/**
 * Distinguishes "this track has no synced lyrics" from "we never reached a
 * provider". Both used to return an empty array, so a blocked API was reported
 * to the user as a confident statement about the track.
 */
export async function getLyricsForTrack(
  params: {
    trackId: string
    trackName: string
    artistName: string
    albumName: string
    durationSec: number
  },
  providers: readonly LyricsProvider[] = DEFAULT_PROVIDERS
): Promise<LyricsResult> {
  if (!TRACK_ID_RE.test(params.trackId)) return { lines: [], status: 'none' }

  const cached = readCached(params.trackId)
  if (cached && cached.length > 0) return { lines: cached, status: 'ok' }

  const now = Date.now()
  const negative = readNegative(params.trackId, now)
  if (negative) return negative

  const { result, provider } = await resolveLyrics(
    {
      trackName: params.trackName,
      artistName: params.artistName,
      albumName: params.albumName,
      durationSec: params.durationSec
    },
    providers
  )

  if (result.status === 'ok' && provider) {
    writeCache(params.trackId, result.lines, provider)
  } else {
    negativeCache.set(params.trackId, {
      status: result.status === 'ok' ? 'none' : result.status,
      expiresAt: now + (result.status === 'unreachable' ? UNREACHABLE_TTL_MS : NONE_TTL_MS)
    })
  }

  return result
}
