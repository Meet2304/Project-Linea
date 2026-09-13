import { describe, it, expect } from 'vitest'
import {
  CrashDeduper,
  crashSignature,
  diagnosticsFromSnapshot,
  formatControls,
  formatOsLabel,
  formatSong,
  friendlyPlayerName,
  parseUserReport
} from '../src/shared/report'
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

const os = {
  version: '0.2.0',
  platform: 'win32',
  osVersion: '10.0.26100',
  arch: 'x64'
}

describe('formatOsLabel', () => {
  it('names Windows with the kernel version and arch', () => {
    expect(formatOsLabel(os)).toBe('Windows 10.0.26100 (x64)')
  })

  it('names macOS rather than darwin', () => {
    expect(
      formatOsLabel({
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

describe('diagnosticsFromSnapshot', () => {
  it('attaches the live session so the reporter does not have to retype it', () => {
    const d = diagnosticsFromSnapshot(os, {
      revision: 1,
      player: player(),
      lyrics: { status: 'ok', lines: [] },
      sourceStatus: 'ready'
    })
    expect(d.version).toBe('0.2.0')
    expect(d.os).toBe('Windows 10.0.26100 (x64)')
    expect(d.player).toBe('Spotify')
    expect(d.song).toBe('Original Song — Original Artist')
    expect(d.controls).toBe('play, pause, next, seek')
    expect(d.lyrics).toBe('ok')
    expect(d.source).toBe('ready')
  })
})

describe('parseUserReport', () => {
  it('accepts a sentence and rejects junk', () => {
    expect(parseUserReport({ kind: 'problem', message: 'Lyrics stuck on the last song.' })).toEqual(
      {
        kind: 'problem',
        message: 'Lyrics stuck on the last song.'
      }
    )
    expect(parseUserReport({ kind: 'crash', message: 'Lyrics stuck on the last song.' })).toBeNull()
    expect(parseUserReport({ kind: 'problem', message: 'short' })).toBeNull()
  })
})

describe('crashSignature / CrashDeduper', () => {
  it('normalizes the signature and allows one send per hour', () => {
    expect(crashSignature('render-process-gone', 'crashed', '0.2.0')).toBe(
      'linea-crash:render-process-gone:crashed:0.2.0'
    )
    const deduper = new CrashDeduper(60_000)
    expect(deduper.allow('linea-crash:gone:crashed:0.2.0', 1_000)).toBe(true)
    expect(deduper.allow('linea-crash:gone:crashed:0.2.0', 2_000)).toBe(false)
    expect(deduper.allow('linea-crash:gone:crashed:0.2.0', 62_000)).toBe(true)
    expect(deduper.allow('', 1_000)).toBe(false)
  })
})
