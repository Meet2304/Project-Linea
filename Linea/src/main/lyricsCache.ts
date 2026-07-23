import { app } from 'electron'
import { join } from 'node:path'
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs'
import { parseLrc, type LyricLine } from '../shared/lyrics'

interface LrcLibResponse {
  syncedLyrics?: string | null
}

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

export async function getLyricsForTrack(params: {
  trackId: string
  trackName: string
  artistName: string
  albumName: string
  durationSec: number
}): Promise<LyricLine[]> {
  if (!TRACK_ID_RE.test(params.trackId)) return []

  const cached = readCached(params.trackId)
  if (cached) return cached

  const url = new URL('https://lrclib.net/api/get')
  url.searchParams.set('track_name', params.trackName)
  url.searchParams.set('artist_name', params.artistName)
  url.searchParams.set('album_name', params.albumName)
  url.searchParams.set('duration', String(params.durationSec))

  let lines: LyricLine[]
  try {
    const response = await fetch(url, { signal: AbortSignal.timeout(10_000) })
    if (!response.ok) return []
    const data = (await response.json()) as LrcLibResponse
    lines = data.syncedLyrics ? parseLrc(data.syncedLyrics) : []
  } catch {
    // Network failure / timeout — no lyrics this time, retry on next track.
    return []
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

  return lines
}
