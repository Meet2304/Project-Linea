import { icons } from './icons'
import { formatTime, formatRemaining } from '../../shared/format'
import type { PlayerState, Prefs } from '../../shared/types'
import type { LyricLine } from '../../shared/lyrics'

function byId<T extends HTMLElement>(id: string): T {
  const node = document.getElementById(id)
  if (!node) throw new Error(`Missing element #${id}`)
  return node as T
}

export const el = {
  app: byId('app'),
  cyma: byId<HTMLCanvasElement>('cyma'),
  connectView: byId('connect-view'),
  playerView: byId('player-view'),
  connectBtn: byId<HTMLButtonElement>('connect-btn'),
  connectStatus: byId('connect-status'),
  trackTitle: byId('track-title'),
  trackArtist: byId('track-artist'),
  seek: byId<HTMLInputElement>('seek'),
  timeElapsed: byId('time-elapsed'),
  timeRemaining: byId('time-remaining'),
  btnShuffle: byId<HTMLButtonElement>('btn-shuffle'),
  btnPrev: byId<HTMLButtonElement>('btn-prev'),
  btnPlay: byId<HTMLButtonElement>('btn-play'),
  btnNext: byId<HTMLButtonElement>('btn-next'),
  btnRepeat: byId<HTMLButtonElement>('btn-repeat'),
  btnLyrics: byId<HTMLButtonElement>('btn-lyrics'),
  btnPin: byId<HTMLButtonElement>('btn-pin'),
  btnSettings: byId<HTMLButtonElement>('btn-settings'),
  btnClose: byId<HTMLButtonElement>('btn-close'),
  nowView: byId('now-view'),
  settingsView: byId('settings-view'),
  lyricsPanel: byId('lyrics-panel'),
  lyricsList: byId('lyrics-list'),
  toast: byId('toast')
}

export function injectStaticIcons(): void {
  el.btnShuffle.innerHTML = icons.shuffle
  el.btnPrev.innerHTML = icons.skipBack
  el.btnNext.innerHTML = icons.skipForward
  el.btnPin.innerHTML = icons.pin
  el.btnSettings.innerHTML = icons.cog
  el.btnClose.innerHTML = icons.x
}

/** The pin button lives with the top-bar controls, not in settings. */
export function reflectPin(pinned: boolean): void {
  el.btnPin.dataset.active = String(pinned)
  el.btnPin.setAttribute('aria-pressed', String(pinned))
  el.btnPin.setAttribute('aria-label', pinned ? 'Unpin from top' : 'Pin on top')
}

export function showView(view: 'connect' | 'player'): void {
  el.connectView.hidden = view !== 'connect'
  el.playerView.hidden = view !== 'player'
}

export function renderHeader(player: PlayerState | null): void {
  if (!player || !player.trackId) {
    el.trackTitle.textContent = 'Nothing playing'
    el.trackArtist.textContent = 'Play a song on Spotify'
    return
  }
  el.trackTitle.textContent = player.trackName
  el.trackArtist.textContent = player.artistName
}

export function renderTransport(player: PlayerState | null, lyricsExpanded: boolean): void {
  const playing = player?.isPlaying ?? false
  el.btnPlay.innerHTML = playing ? icons.pause : icons.play

  el.btnShuffle.dataset.active = String(player?.shuffle ?? false)

  const repeat = player?.repeat ?? 'off'
  el.btnRepeat.innerHTML = repeat === 'track' ? icons.repeatOne : icons.repeat
  el.btnRepeat.dataset.active = String(repeat !== 'off')

  el.btnLyrics.innerHTML = lyricsExpanded ? icons.chevronDown : icons.mic
  el.btnLyrics.dataset.active = String(lyricsExpanded)
}

export function renderScrubber(positionMs: number, durationMs: number): void {
  const ratio = durationMs > 0 ? Math.min(1, Math.max(0, positionMs / durationMs)) : 0
  el.seek.value = String(Math.round(ratio * 1000))
  el.seek.style.setProperty('--fill', String(ratio * 100))
  el.timeElapsed.textContent = formatTime(positionMs)
  el.timeRemaining.textContent = formatRemaining(durationMs, positionMs)
}

/**
 * Render a window of lyric lines centered on the active one. `windowSize`
 * comes from the caller, which measures how many lines fit the (resizable)
 * panel — a taller panel shows more of the song.
 */
export function renderLyrics(lines: LyricLine[], activeIndex: number, windowSize = 3): void {
  if (lines.length === 0) {
    el.lyricsList.replaceChildren(emptyMessage('No synced lyrics for this track'))
    return
  }
  const size = Math.max(1, Math.min(windowSize, lines.length))
  const half = Math.floor(size / 2)
  const start = Math.max(0, Math.min(activeIndex - half, lines.length - size))
  const rows: HTMLElement[] = []
  for (let i = start; i < start + size; i++) {
    const row = document.createElement('div')
    row.className = 'lyric-row'
    row.dataset.pos = i === activeIndex ? 'active' : i < activeIndex ? 'past' : 'next'
    row.textContent = lines[i].text || '…'
    rows.push(row)
  }
  el.lyricsList.replaceChildren(...rows)
}

function emptyMessage(text: string): HTMLElement {
  const div = document.createElement('div')
  div.className = 'lyrics-empty'
  div.textContent = text
  return div
}

export function setLyricsVisible(visible: boolean): void {
  el.lyricsPanel.hidden = !visible
}

export function applyPrefsToDom(prefs: Prefs): void {
  document.documentElement.dataset.theme = prefs.theme
  document.documentElement.style.setProperty('--panel-alpha', String(prefs.opacity))
  document.documentElement.style.setProperty('--lyrics-size', `${prefs.fontSize}px`)
}

let toastTimer: ReturnType<typeof setTimeout> | null = null

export function showToast(message: string): void {
  el.toast.textContent = message
  el.toast.hidden = false
  if (toastTimer) clearTimeout(toastTimer)
  toastTimer = setTimeout(() => {
    el.toast.hidden = true
    toastTimer = null
  }, 3200)
}
