import { describe, it, expect } from 'vitest'
import {
  SessionMapper,
  selectSession,
  mediaTrackId,
  lookupTitle,
  parseSessions
} from '../src/main/smtcState'
import { estimatePositionMs } from '../src/shared/lyrics'
import { keepFeedback, optimisticPlayer, mergeFeedback } from '../src/shared/playbackFeedback'
import { media, NOW } from './fixtures/media'
describe('session selection and validation', () => {
  it('prefers music over a current video and preserves paused selection', () => {
    const song = media({ id: 'music', current: false })
    const video = media({ id: 'video', current: true, mediaType: 'video' })
    expect(selectSession([video, song])?.id).toBe('music')
    expect(selectSession([video, { ...song, status: 'paused' }], 'music')?.id).toBe('video')
    expect(
      selectSession(
        [
          { ...video, status: 'paused' },
          { ...song, status: 'paused' }
        ],
        'music'
      )?.id
    ).toBe('music')
  })
  it('breaks active ties by current, previous, then discovery order', () => {
    const a = media({ id: 'a', current: false }),
      b = media({ id: 'b', current: false })
    expect(selectSession([a, b], 'b')?.id).toBe('b')
    expect(selectSession([a, { ...b, current: true }], 'a')?.id).toBe('b')
    expect(selectSession([a, b])?.id).toBe('a')
    expect(selectSession([])).toBeNull()
  })
  it('distinguishes two sessions from the same application', () => {
    expect(selectSession([media({ id: 'a', current: false }), media({ id: 'b' })])?.id).toBe('b')
  })
  it('rejects malformed native snapshots', () => {
    expect(parseSessions({ sessions: [media()] })).toHaveLength(1)
    for (const value of [null, { sessions: [{}] }, { sessions: [media({ rate: Infinity })] }])
      expect(() => parseSessions(value)).toThrow()
  })
})
describe('media identity', () => {
  it('normalizes whitespace and case, uses 64 safe hex characters', () => {
    const key = mediaTrackId(' Title ', ' ARTIST ', 'Album', 123456)
    expect(key).toMatch(/^[a-f0-9]{64}$/)
    expect(key).toBe(mediaTrackId('title', 'artist', 'album', 123499))
    expect(mediaTrackId('../日本語 / title', 'artist', '', 0)).toMatch(/^[a-f0-9]{64}$/)
    expect(mediaTrackId(' ', 'artist', '', 0)).toBeNull()
  })
  it('keeps distinct recordings and unknown versus known duration apart', () => {
    const normal = mediaTrackId('Song', 'Artist', '', 100000)
    for (const title of ['Song (Live)', 'Song (Remix)', 'Song (Cover)'])
      expect(mediaTrackId(title, 'Artist', '', 100000)).not.toBe(normal)
    expect(mediaTrackId('Song', 'Artist', '', 0)).not.toBe(normal)
  })
  it('only removes explicit promotional suffixes', () => {
    expect(lookupTitle('Song (Official Music Video)')).toBe('Song')
    expect(lookupTitle('Song (Live)')).toBe('Song (Live)')
    expect(lookupTitle('Artist - Song')).toBe('Artist - Song')
  })
})
describe('timeline mapping', () => {
  it('uses LastUpdatedTime once and does not reset on repeated stale reads', () => {
    const mapper = new SessionMapper(),
      raw = media()
    const a = mapper.map(raw, NOW + 2000),
      b = mapper.map(raw, NOW + 3000)
    expect(a.progressMs).toBe(12000)
    expect(a.sourceAppId).toBe('player')
    expect(b.fetchedAt).toBe(a.fetchedAt)
    expect(estimatePositionMs(b, NOW + 4000)).toBe(14000)
  })
  it('freezes on pause and resumes without counting the paused gap', () => {
    const mapper = new SessionMapper()
    mapper.map(media(), NOW)
    const paused = mapper.map(media({ status: 'paused' }), NOW + 2000)
    expect(estimatePositionMs(paused, NOW + 10000)).toBe(12000)
    const resumed = mapper.map(media(), NOW + 12000)
    expect(estimatePositionMs(resumed, NOW + 13000)).toBe(13000)
  })
  it('respects rate changes, seeks, duration and nonzero start/seek bounds', () => {
    const mapper = new SessionMapper()
    const raw = media({
      rate: 2,
      timeline: {
        startMs: 5000,
        endMs: 25000,
        positionMs: 10000,
        updatedAt: NOW,
        minSeekMs: 7000,
        maxSeekMs: 22000
      }
    })
    const p = mapper.map(raw, NOW + 1000)
    expect(p.durationMs).toBe(20000)
    expect(p.progressMs).toBe(7000)
    expect(p.seekMinMs).toBe(2000)
    expect(p.seekMaxMs).toBe(17000)
    expect(estimatePositionMs(p, NOW + 100000)).toBe(20000)
    const seek = mapper.map(
      { ...raw, timeline: { ...raw.timeline, positionMs: 20000, updatedAt: NOW + 2000 } },
      NOW + 2000
    )
    expect(seek.progressMs).toBe(15000)
  })
  it('disables timing and seek when the timeline is absent; preserves toggle fallback', () => {
    const p = new SessionMapper().map(
      media({
        shuffle: null,
        repeat: null,
        timeline: {
          startMs: 0,
          endMs: 0,
          positionMs: 0,
          updatedAt: -11644473600000,
          minSeekMs: 0,
          maxSeekMs: 0
        }
      }),
      NOW
    )
    expect(p.timelineValid).toBe(false)
    expect(p.capabilities.seek).toBe(false)
    expect(p.capabilities.shuffle).toBe(false)
    expect(p.capabilities.repeat).toBe(false)
    expect(p.capabilities.play).toBe(true)
    expect(estimatePositionMs(p, NOW + 10000)).toBe(0)
  })
  it('accepts a fresh source after mapper reset', () => {
    const mapper = new SessionMapper()
    mapper.map(media(), NOW)
    mapper.reset()
    expect(mapper.map(media({ status: 'paused' }), NOW + 10000).progressMs).toBe(10000)
  })
})
describe('optimistic command feedback', () => {
  it('never carries an old seek to a replacement track or restarted helper', () => {
    const actual = new SessionMapper().map(media(), NOW)
    const feedback = {
      command: { type: 'seek' as const, positionMs: 50000 },
      player: optimisticPlayer(actual, { type: 'seek', positionMs: 50000 }, NOW),
      expiresAt: NOW + 1500
    }
    expect(keepFeedback(feedback, actual, NOW + 100)).toBe(true)
    expect(keepFeedback(feedback, { ...actual, trackId: 'other' }, NOW + 100)).toBe(false)
    expect(keepFeedback(feedback, { ...actual, sessionId: '2:1' }, NOW + 100)).toBe(false)
    expect(keepFeedback(feedback, actual, NOW + 2000)).toBe(false)
    expect(keepFeedback(feedback, { ...actual, progressMs: 50000 }, NOW + 100)).toBe(false)
    expect(mergeFeedback({ ...actual, shuffle: true }, feedback).shuffle).toBe(true)
  })
})
