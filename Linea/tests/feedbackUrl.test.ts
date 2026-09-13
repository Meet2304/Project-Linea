import { describe, it, expect } from 'vitest'
import {
  FEEDBACK_PAGE,
  feedbackPageUrl,
  feedbackPageUrlFromSession,
  formatControls,
  formatSong,
  formatWindowsLabel,
  friendlyPlayerName
} from '../src/shared/feedbackUrl'
import type { PlayerState } from '../src/shared/types'

const caps = {
  play: true,
  pause: true,
  next: true,
  previous: false,
  seek: true,
  shuffle: false,
  repeat: false
}

function player(over: Partial<PlayerState> = {}): PlayerState {
  return {
    sessionId: '1:1',
    mediaRevision: 1,
    isPlaying: true,
    trackId: 'abc',
    trackName: 'Original Song',
    artistName: 'Original Artist',
    albumName: 'Album',
    durationMs: 180000,
    progressMs: 1000,
    fetchedAt: 1,
    playbackRate: 1,
    timelineValid: true,
    seekMinMs: 0,
    seekMaxMs: 180000,
    capabilities: caps,
    shuffle: false,
    repeat: 'off',
    sourceAppId: 'Spotify.exe',
    ...over
  }
}

describe('formatWindowsLabel', () => {
  it('names Windows with the kernel version and arch', () => {
    expect(
      formatWindowsLabel({
        version: '0.2.0',
        platform: 'win32',
        osVersion: '10.0.26100',
        arch: 'x64'
      })
    ).toBe('Windows 10.0.26100 (x64)')
  })

  it('names macOS rather than darwin', () => {
    expect(
      formatWindowsLabel({
        version: '0.1.6',
        platform: 'darwin',
        osVersion: '24.0.0',
        arch: 'arm64'
      })
    ).toBe('macOS 24.0.0 (arm64)')
  })
})

describe('friendlyPlayerName', () => {
  it('maps common AUMIDs to a human name', () => {
    expect(friendlyPlayerName('Spotify.exe')).toBe('Spotify')
    expect(friendlyPlayerName('Chrome.Application')).toBe('Chrome')
    expect(friendlyPlayerName('Microsoft.ZuneMusic_8wekyb3d8bbwe')).toBe('Windows Media Player')
  })

  it('passes through unknown ids so the report still names them', () => {
    expect(friendlyPlayerName('SomeObscurePlayer.exe')).toBe('SomeObscurePlayer.exe')
  })
})

describe('formatControls / formatSong', () => {
  it('lists only the controls the session actually exposes', () => {
    expect(formatControls(caps)).toBe('play, pause, next, seek')
  })

  it('joins title and artist, and stays empty when nothing is playing', () => {
    expect(formatSong(player())).toBe('Original Song — Original Artist')
    expect(formatSong(player({ trackId: null, trackName: '', artistName: '' }))).toBe('')
  })
})

describe('feedbackPageUrl', () => {
  it('omits empty fields and clips long values', () => {
    const url = feedbackPageUrl({
      version: '0.2.0',
      player: '  Spotify  ',
      song: '',
      windows: 'x'.repeat(400)
    })
    expect(url.startsWith(`${FEEDBACK_PAGE}?`)).toBe(true)
    const params = new URLSearchParams(url.slice(FEEDBACK_PAGE.length + 1))
    expect(params.get('version')).toBe('0.2.0')
    expect(params.get('player')).toBe('Spotify')
    expect(params.get('song')).toBeNull()
    expect(params.get('windows')?.length).toBe(300)
  })

  it('returns the bare page when there is nothing to prefill', () => {
    expect(feedbackPageUrl({})).toBe(FEEDBACK_PAGE)
  })
})

describe('feedbackPageUrlFromSession', () => {
  const diagnostics = {
    version: '0.2.0',
    platform: 'win32' as const,
    osVersion: '10.0.26100',
    arch: 'x64'
  }

  it('prefills the live session so the form does not ask people to retype it', () => {
    const url = feedbackPageUrlFromSession({
      diagnostics,
      player: player(),
      lyricsStatus: 'ok',
      sourceStatus: 'ready'
    })
    const params = new URLSearchParams(url.slice(FEEDBACK_PAGE.length + 1))
    expect(params.get('version')).toBe('0.2.0')
    expect(params.get('windows')).toBe('Windows 10.0.26100 (x64)')
    expect(params.get('player')).toBe('Spotify')
    expect(params.get('song')).toBe('Original Song — Original Artist')
    expect(params.get('controls')).toBe('play, pause, next, seek')
    expect(params.get('lyrics')).toBe('ok')
    expect(params.get('source')).toBe('ready')
    expect(params.get('kind')).toBeNull()
  })

  it('points at lyrics trouble when the providers had nothing', () => {
    const url = feedbackPageUrlFromSession({
      diagnostics,
      player: player(),
      lyricsStatus: 'none',
      sourceStatus: 'ready'
    })
    const params = new URLSearchParams(url.slice(FEEDBACK_PAGE.length + 1))
    expect(params.get('kind')).toBe('lyrics')
  })

  it('points at playback trouble when the helper is down', () => {
    const url = feedbackPageUrlFromSession({
      diagnostics,
      player: null,
      lyricsStatus: 'none',
      sourceStatus: 'unavailable'
    })
    const params = new URLSearchParams(url.slice(FEEDBACK_PAGE.length + 1))
    expect(params.get('kind')).toBe('playback')
    expect(params.get('player')).toBeNull()
    expect(params.get('song')).toBeNull()
  })
})
