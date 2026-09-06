import type { MediaSession } from '../../src/main/smtcState'
export const NOW = 1_800_000_000_000
export function media(over: Partial<MediaSession> = {}): MediaSession {
  return {
    id: '1:1',
    mediaRevision: 1,
    appId: 'player',
    current: true,
    title: 'Original Song',
    artist: 'Original Artist',
    album: 'Album',
    mediaType: 'music',
    status: 'playing',
    rate: null,
    shuffle: false,
    repeat: 'off',
    controls: {
      play: false,
      pause: true,
      toggle: true,
      next: true,
      previous: true,
      seek: true,
      shuffle: true,
      repeat: true
    },
    timeline: {
      startMs: 0,
      endMs: 180000,
      positionMs: 10000,
      updatedAt: NOW,
      minSeekMs: 0,
      maxSeekMs: 180000
    },
    ...over
  }
}
