import type {
  ApiResult,
  PlaybackSnapshot,
  PlayerCommandRequest,
  PlayerState
} from '../shared/types'
import type { LyricsResult } from '../shared/lyrics'
import { estimatePositionMs } from '../shared/lyrics'
import { nextPollDelay } from '../shared/pollPolicy'
import { lookupTitle, selectSession, SessionMapper } from './smtcState'
import type { SmtcBridge } from './smtcBridge'

const EMPTY: LyricsResult = { lines: [], status: 'none' }
type Lookup = (params: {
  trackId: string
  trackName: string
  artistName: string
  albumName: string
  durationSec: number
}) => Promise<LyricsResult>
export function validCommandRequest(value: unknown): value is PlayerCommandRequest {
  if (!value || typeof value !== 'object') return false
  const r = value as PlayerCommandRequest
  if (
    typeof r.sessionId !== 'string' ||
    !(r.trackId === null || typeof r.trackId === 'string') ||
    !Number.isSafeInteger(r.mediaRevision) ||
    !r.command ||
    typeof r.command !== 'object'
  )
    return false
  const c = r.command
  switch (c.type) {
    case 'play':
    case 'pause':
    case 'next':
    case 'previous':
      return true
    case 'seek':
      return Number.isFinite(c.positionMs) && c.positionMs >= 0
    case 'shuffle':
      return typeof c.state === 'boolean'
    case 'repeat':
      return ['off', 'context', 'track'].includes(c.mode)
    default:
      return false
  }
}
export class PlaybackController {
  private snapshot: PlaybackSnapshot
  private mapper = new SessionMapper()
  private timer: ReturnType<typeof setTimeout> | null = null
  private retry: ReturnType<typeof setTimeout> | null = null
  private timerDue = 0
  private running = false
  private reading = false
  private dirty = false
  private generation = 0
  private sourceGeneration = 0
  private lookups = new Map<string, Promise<LyricsResult>>()
  constructor(
    private readonly bridge: SmtcBridge | null,
    private readonly lookup: Lookup,
    private readonly publish: (snapshot: PlaybackSnapshot, lyricsOnly: boolean) => void,
    private readonly initialized: () => void = () => {}
  ) {
    this.snapshot = {
      revision: 0,
      player: null,
      lyrics: EMPTY,
      sourceStatus: bridge ? 'idle' : 'unsupported'
    }
    bridge?.on('ready', () => {
      this.initialized()
      this.schedule(0)
    })
    bridge?.on('changed', () => this.schedule(50))
    bridge?.on('unavailable', () => {
      this.sourceGeneration++
      this.clearTrack()
      this.mapper.reset()
      this.set({ player: null, lyrics: EMPTY, sourceStatus: 'unavailable' })
    })
  }
  getSnapshot(): PlaybackSnapshot {
    return this.snapshot
  }
  start(): void {
    this.running = true
    this.bridge?.start()
  }
  stop(): void {
    this.running = false
    this.sourceGeneration++
    this.clearTrack()
    if (this.timer) clearTimeout(this.timer)
    this.timer = null
    this.bridge?.stop()
  }
  resume(): void {
    this.sourceGeneration++
    this.clearTrack()
    this.mapper.reset()
    this.set({
      player: null,
      lyrics: EMPTY,
      sourceStatus: this.bridge ? 'unavailable' : 'unsupported'
    })
    this.bridge?.resume()
  }
  private set(update: Partial<PlaybackSnapshot>, lyricsOnly = false): void {
    const next = { ...this.snapshot, ...update }
    if (
      JSON.stringify({ ...next, revision: 0 }) === JSON.stringify({ ...this.snapshot, revision: 0 })
    )
      return
    this.snapshot = { ...next, revision: this.snapshot.revision + 1 }
    this.publish(this.snapshot, lyricsOnly)
  }
  private clearTrack(): void {
    this.generation++
    if (this.retry) clearTimeout(this.retry)
    this.retry = null
  }
  private schedule(delay?: number): void {
    if (!this.running || !this.bridge) return
    if (this.reading) {
      this.dirty = true
      return
    }
    const p = this.snapshot.player
    const next =
      delay ??
      nextPollDelay({
        isPlaying: p?.isPlaying ?? false,
        msToTrackEnd:
          p?.timelineValid && p.durationMs > 0
            ? Math.max(0, p.durationMs - estimatePositionMs(p))
            : null
      })
    if (this.timer && this.timerDue <= Date.now() + next) return
    if (this.timer) clearTimeout(this.timer)
    this.timerDue = Date.now() + next
    this.timer = setTimeout(() => {
      this.timer = null
      void this.poll()
    }, next)
  }
  async poll(): Promise<void> {
    if (!this.bridge || !this.running || this.reading) return
    this.reading = true
    const generation = this.sourceGeneration
    try {
      const result = await this.bridge.read()
      if (!this.running || generation !== this.sourceGeneration) return
      if (!result.ok) {
        this.clearTrack()
        this.mapper.reset()
        this.set({ player: null, lyrics: EMPTY, sourceStatus: 'unavailable' })
        return
      }
      const selected = selectSession(result.data, this.snapshot.player?.sessionId)
      if (!selected) {
        this.clearTrack()
        this.mapper.reset()
        this.set({ player: null, lyrics: EMPTY, sourceStatus: 'idle' })
        return
      }
      const p = this.mapper.map(selected)
      const old = this.snapshot.player
      const changed = old?.trackId !== p.trackId || old?.sessionId !== p.sessionId
      if (changed) this.clearTrack()
      this.set({ player: p, sourceStatus: 'ready', ...(changed ? { lyrics: EMPTY } : {}) })
      if (changed) void this.refreshLyrics(p, this.generation)
    } finally {
      this.reading = false
      const dirty = this.dirty
      this.dirty = false
      this.schedule(dirty ? 50 : undefined)
    }
  }
  private async refreshLyrics(p: PlayerState, generation: number): Promise<void> {
    if (!p.trackId || !p.trackName.trim() || !p.artistName.trim()) return
    const key = p.trackId
    let pending = this.lookups.get(key)
    if (!pending) {
      pending = this.lookup({
        trackId: key,
        trackName: lookupTitle(p.trackName),
        artistName: p.artistName,
        albumName: p.albumName,
        durationSec: Math.round(p.durationMs / 1000)
      }).catch((): LyricsResult => ({ lines: [], status: 'unreachable' }))
      this.lookups.set(key, pending)
      void pending.finally(() => this.lookups.delete(key))
    }
    const lyrics = await pending
    if (!this.running || generation !== this.generation) return
    this.set({ lyrics }, true)
    if (lyrics.status === 'unreachable')
      this.retry = setTimeout(() => {
        this.retry = null
        void this.refreshLyrics(p, generation)
      }, 60_100)
  }
  async command(request: unknown): Promise<ApiResult<null>> {
    if (!validCommandRequest(request)) return { ok: false, reason: 'invalid_request' }
    const p = this.snapshot.player
    if (
      !p ||
      p.sessionId !== request.sessionId ||
      p.trackId !== request.trackId ||
      p.mediaRevision !== request.mediaRevision
    )
      return { ok: false, reason: 'session_unavailable' }
    const c = request.command
    if (!p.capabilities[c.type]) return { ok: false, reason: 'unsupported_command' }
    if (c.type === 'seek' && (c.positionMs < p.seekMinMs || c.positionMs > p.seekMaxMs))
      return { ok: false, reason: 'invalid_request' }
    if (!this.bridge) return { ok: false, reason: 'source_unavailable' }
    const result = await this.bridge.command(request)
    this.schedule(400)
    return result
  }
}
