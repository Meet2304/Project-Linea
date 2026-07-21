import { app } from 'electron'
import { join } from 'node:path'
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs'
import { parseLrc, type LyricLine } from '../shared/lyrics'

interface LrcLibResponse {
  syncedLyrics?: string | null
}

const cacheDir = (): string => join(app.getPath('userData'), 'lyrics-cache')
const cacheFile = (trackId: string): string => join(cacheDir(), `${trackId}.json`)

export async function getLyricsForTrack(params: {
  trackId: string
  trackName: string
  artistName: string
  albumName: string
  durationSec: number
}): Promise<LyricLine[]> {
  if (existsSync(cacheFile(params.trackId))) {
    return JSON.parse(readFileSync(cacheFile(params.trackId), 'utf-8')) as LyricLine[]
  }

  const url = new URL('https://lrclib.net/api/get')
  url.searchParams.set('track_name', params.trackName)
  url.searchParams.set('artist_name', params.artistName)
  url.searchParams.set('album_name', params.albumName)
  url.searchParams.set('duration', String(params.durationSec))

  const response = await fetch(url)
  if (!response.ok) return []

  const data = (await response.json()) as LrcLibResponse
  const lines = data.syncedLyrics ? parseLrc(data.syncedLyrics) : []

  // Only cache non-empty results so a transient miss isn't sticky forever.
  if (lines.length > 0) {
    mkdirSync(cacheDir(), { recursive: true })
    writeFileSync(cacheFile(params.trackId), JSON.stringify(lines))
  }

  return lines
}
