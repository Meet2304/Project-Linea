import { createHash } from 'node:crypto'
import type { PlayerState, RepeatMode } from '../shared/types'
import { estimatePositionMs } from '../shared/lyrics'

export interface MediaSession {
  id: string
  mediaRevision: number
  appId: string
  current: boolean
  title: string
  artist: string
  album: string
  mediaType: 'music' | 'video' | 'unknown'
  status: 'playing' | 'paused' | 'stopped' | 'other'
  rate: number | null
  shuffle: boolean | null
  repeat: RepeatMode | null
  controls: Record<
    'play' | 'pause' | 'toggle' | 'next' | 'previous' | 'seek' | 'shuffle' | 'repeat',
    boolean
  >
  timeline: {
    startMs: number
    endMs: number
    positionMs: number
    updatedAt: number
    minSeekMs: number
    maxSeekMs: number
  }
}
const record = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null
const finite = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v)
export function parseSessions(value: unknown): MediaSession[] {
  if (!record(value) || !Array.isArray(value.sessions) || value.sessions.length > 128)
    throw new Error('Invalid media snapshot')
  for (const s of value.sessions) {
    if (
      !record(s) ||
      !['id', 'appId', 'title', 'artist', 'album'].every(
        (k) => typeof s[k] === 'string' && (s[k] as string).length <= 16384
      ) ||
      !finite(s.mediaRevision) ||
      s.mediaRevision < 1 ||
      typeof s.current !== 'boolean' ||
      !['music', 'video', 'unknown'].includes(String(s.mediaType)) ||
      !['playing', 'paused', 'stopped', 'other'].includes(String(s.status)) ||
      !(s.rate === null || finite(s.rate)) ||
      !(s.shuffle === null || typeof s.shuffle === 'boolean') ||
      !(s.repeat === null || ['off', 'context', 'track'].includes(String(s.repeat))) ||
      !record(s.controls) ||
      !['play', 'pause', 'toggle', 'next', 'previous', 'seek', 'shuffle', 'repeat'].every(
        (k) => typeof (s.controls as Record<string, unknown>)[k] === 'boolean'
      ) ||
      !record(s.timeline) ||
      !['startMs', 'endMs', 'positionMs', 'updatedAt', 'minSeekMs', 'maxSeekMs'].every((k) =>
        finite((s.timeline as Record<string, unknown>)[k])
      )
    ) {
      throw new Error('Invalid media session')
    }
  }
  return value.sessions as MediaSession[]
}
export function selectSession(sessions: MediaSession[], previousId?: string): MediaSession | null {
  const choose = (pool: MediaSession[]): MediaSession | undefined =>
    pool.find((s) => s.current) ?? pool.find((s) => s.id === previousId) ?? pool[0]
  const playing = sessions.filter((s) => s.status === 'playing')
  return (
    choose(playing.filter((s) => s.mediaType === 'music')) ??
    choose(playing) ??
    sessions.find((s) => s.id === previousId && s.status === 'paused') ??
    sessions.find((s) => s.current) ??
    sessions[0] ??
    null
  )
}
const normalizeIdentity = (s: string): string =>
  s.normalize('NFKC').toLowerCase().trim().replace(/\s+/gu, ' ')
export function mediaTrackId(
  title: string,
  artist: string,
  album: string,
  durationMs: number
): string | null {
  if (!title.trim()) return null
  return createHash('sha256')
    .update(
      JSON.stringify([
        'smtc1',
        normalizeIdentity(title),
        normalizeIdentity(artist),
        normalizeIdentity(album),
        durationMs > 0 ? Math.round(durationMs / 1000) : 0
      ])
    )
    .digest('hex')
}
/** Only remove explicitly promotional suffixes, retaining recording qualifiers. */
export function lookupTitle(title: string): string {
  return title
    .replace(/\s*[([](?:official (?:music )?video|official audio|lyric(?:s)? video)[)\]]\s*$/iu, '')
    .trim()
}
export class SessionMapper {
  private raw: MediaSession | null = null
  private state: PlayerState | null = null
  reset(): void {
    this.raw = null
    this.state = null
  }
  map(s: MediaSession, now = Date.now()): PlayerState {
    const t = s.timeline
    const durationMs = Math.max(0, t.endMs - t.startMs)
    const trackId = mediaTrackId(s.title, s.artist, s.album, durationMs)
    const previous = this.state
    const sameTrack = previous?.sessionId === s.id && previous.trackId === trackId
    const unchangedClock =
      sameTrack && this.raw !== null && JSON.stringify(this.raw.timeline) === JSON.stringify(t)
    const isPlaying = s.status === 'playing'
    const playbackRate = s.rate === null ? 1 : Math.max(0, s.rate)
    const timelineValid =
      t.updatedAt > 0 &&
      t.updatedAt <= now + 5000 &&
      t.positionMs >= t.startMs &&
      (durationMs === 0 || t.positionMs <= t.endMs)
    const clamp = (p: number): number => Math.max(0, durationMs > 0 ? Math.min(durationMs, p) : p)
    let progressMs = timelineValid ? clamp(t.positionMs - t.startMs) : 0
    let fetchedAt = now
    if (unchangedClock && previous) {
      if (previous.isPlaying === isPlaying && previous.playbackRate === playbackRate) {
        progressMs = previous.progressMs
        fetchedAt = previous.fetchedAt
      } else {
        progressMs = clamp(estimatePositionMs(previous, now))
      }
    } else if (timelineValid && isPlaying) {
      progressMs = clamp(progressMs + Math.max(0, now - t.updatedAt) * playbackRate)
    }
    const seekMinMs = Math.max(0, t.minSeekMs - t.startMs)
    const seekMaxMs = Math.max(0, Math.min(durationMs, t.maxSeekMs - t.startMs))
    const c = s.controls
    const state: PlayerState = {
      sessionId: s.id,
      mediaRevision: s.mediaRevision,
      trackId,
      trackName: s.title,
      artistName: s.artist,
      albumName: s.album,
      isPlaying,
      durationMs,
      progressMs,
      fetchedAt,
      playbackRate,
      timelineValid,
      seekMinMs,
      seekMaxMs,
      shuffle: s.shuffle,
      repeat: s.repeat,
      capabilities: {
        play: c.play || c.toggle,
        pause: c.pause || c.toggle,
        next: c.next,
        previous: c.previous,
        seek: c.seek && timelineValid && seekMaxMs > seekMinMs,
        shuffle: c.shuffle && s.shuffle !== null,
        repeat: c.repeat && s.repeat !== null
      }
    }
    this.raw = s
    this.state = state
    return state
  }
}
