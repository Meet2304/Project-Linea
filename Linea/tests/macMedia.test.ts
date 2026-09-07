import { readFileSync } from 'node:fs'
import { runInNewContext } from 'node:vm'
import { describe, expect, it, vi } from 'vitest'
const source = readFileSync(new URL('../native/mac/media.js', import.meta.url), 'utf8')
function fixture(bundle = 'com.spotify.client'): {
  app: Record<string, unknown>
  target: Record<string, unknown>
  run: (request: Record<string, unknown>) => {
    ok: boolean
    reason?: string
    data?: { sessions: Array<Record<string, unknown>> }
  }
} {
  const app = {
    playerState: () => 'playing',
    playerPosition: () => 12.5,
    currentTrack: () => ({
      name: () => 'Song',
      artist: () => 'Artist',
      album: () => 'Album',
      duration: () => (bundle === 'com.spotify.client' ? 180000 : 180),
      id: () => 'spotify:track:1',
      persistentID: () => 'music1'
    }),
    shufflingEnabled: () => true,
    repeatingEnabled: () => true,
    shuffling: () => false,
    repeating: () => true,
    shuffleEnabled: () => true,
    songRepeat: () => 'one',
    nextTrack: vi.fn(),
    play: vi.fn(),
    pause: vi.fn()
  }
  const target = { bundle, id: bundle + ':42', current: false }
  return {
    app,
    target,
    run: (request) =>
      runInNewContext(source + '\nhandle(request)', { Application: () => app, request })
  }
}
describe('Mac Automation adapter', () => {
  it('maps Spotify milliseconds and Music seconds to the same timeline', () => {
    for (const bundle of ['com.spotify.client', 'com.apple.Music']) {
      const f = fixture(bundle),
        result = f.run({ method: 'snapshot', targets: [f.target] })
      expect(result.data?.sessions[0].timeline).toMatchObject({ endMs: 180000, positionMs: 12500 })
      expect(result.data?.sessions[0].title).toBe('Song')
    }
  })
  it('advertises only off/all repeat for Spotify and all three modes for Music', () => {
    const spotify = fixture(),
      music = fixture('com.apple.Music')
    expect(
      spotify.run({ method: 'snapshot', targets: [spotify.target] }).data?.sessions[0]
    ).toMatchObject({ repeat: 'context', repeatModes: ['off', 'context'] })
    expect(
      music.run({ method: 'snapshot', targets: [music.target] }).data?.sessions[0]
    ).toMatchObject({ repeat: 'track', repeatModes: ['off', 'context', 'track'] })
  })
  it('rejects stale tracks before issuing a command', () => {
    const f = fixture()
    expect(
      f.run({ method: 'command', targets: [f.target], nativeKey: 'old song', command: 'next' })
        .reason
    ).toBe('session_unavailable')
    expect(f.app.nextTrack).not.toHaveBeenCalled()
  })
  it('rejects out-of-bounds seeks and unsupported repeat-one', () => {
    const f = fixture(),
      nativeKey = f.run({ method: 'snapshot', targets: [f.target] }).data?.sessions[0].nativeKey
    expect(
      f.run({
        method: 'command',
        targets: [f.target],
        nativeKey,
        command: 'seek',
        positionMs: 190000
      }).reason
    ).toBe('invalid_request')
    expect(
      f.run({ method: 'command', targets: [f.target], nativeKey, command: 'repeat', mode: 'track' })
        .reason
    ).toBe('unsupported_command')
  })
  it('sets position in seconds and maps Music repeat-one', () => {
    const f = fixture('com.apple.Music'),
      nativeKey = f.run({ method: 'snapshot', targets: [f.target] }).data?.sessions[0].nativeKey
    expect(
      f.run({
        method: 'command',
        targets: [f.target],
        nativeKey,
        command: 'seek',
        positionMs: 30000
      }).ok
    ).toBe(true)
    expect(f.app.playerPosition).toBe(30)
    f.app.playerPosition = () => 30
    expect(
      f.run({ method: 'command', targets: [f.target], nativeKey, command: 'repeat', mode: 'track' })
        .ok
    ).toBe(true)
    expect(f.app.songRepeat).toBe('one')
  })
  it('does not invent paused or stopped tracks and keeps optional controls nullable', () => {
    const f = fixture()
    f.app.playerState = () => 'stopped'
    expect(f.run({ method: 'snapshot', targets: [f.target] }).data?.sessions).toHaveLength(0)
    f.app.playerState = () => 'paused'
    f.app.shufflingEnabled = () => false
    f.app.repeatingEnabled = () => false
    expect(f.run({ method: 'snapshot', targets: [f.target] }).data?.sessions[0]).toMatchObject({
      status: 'paused',
      shuffle: null,
      repeat: null
    })
  })
})
