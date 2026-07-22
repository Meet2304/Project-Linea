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
  connectView: byId('connect-view'),
  playerView: byId('player-view'),
  connectBtn: byId<HTMLButtonElement>('connect-btn'),
  connectStatus: byId('connect-status'),
  art: byId<HTMLCanvasElement>('art'),
  trackTitle: byId('track-title'),
  trackArtist: byId('track-artist'),
  stateTag: byId('state-tag'),
  seek: byId<HTMLInputElement>('seek'),
  timeElapsed: byId('time-elapsed'),
  timeRemaining: byId('time-remaining'),
  btnShuffle: byId<HTMLButtonElement>('btn-shuffle'),
  btnPrev: byId<HTMLButtonElement>('btn-prev'),
  btnPlay: byId<HTMLButtonElement>('btn-play'),
  btnNext: byId<HTMLButtonElement>('btn-next'),
  btnRepeat: byId<HTMLButtonElement>('btn-repeat'),
  btnLike: byId<HTMLButtonElement>('btn-like'),
  btnLyrics: byId<HTMLButtonElement>('btn-lyrics'),
  btnSettings: byId<HTMLButtonElement>('btn-settings'),
  lyricsPanel: byId('lyrics-panel'),
  lyricsState: byId('lyrics-state'),
  lyricsList: byId('lyrics-list'),
  toast: byId('toast')
}

export function injectStaticIcons(): void {
  el.btnShuffle.innerHTML = icons.shuffle
  el.btnPrev.innerHTML = icons.skipBack
  el.btnNext.innerHTML = icons.skipForward
  el.btnSettings.innerHTML = icons.sliders
}

export function showView(view: 'connect' | 'player'): void {
  el.connectView.hidden = view !== 'connect'
  el.playerView.hidden = view !== 'player'
}

export function renderHeader(player: PlayerState | null): void {
  if (!player || !player.trackId) {
    el.trackTitle.textContent = 'Nothing playing'
    el.trackArtist.textContent = 'Play a song on Spotify'
    el.stateTag.hidden = true
    return
  }
  el.trackTitle.textContent = player.trackName
  el.trackArtist.textContent = player.artistName
  el.stateTag.hidden = false
  el.stateTag.textContent = player.isPlaying ? 'Now playing' : 'Paused'
}

export function renderTransport(player: PlayerState | null, lyricsExpanded: boolean): void {
  const playing = player?.isPlaying ?? false
  el.btnPlay.innerHTML = playing ? icons.pause : icons.play

  el.btnShuffle.dataset.active = String(player?.shuffle ?? false)

  const repeat = player?.repeat ?? 'off'
  el.btnRepeat.innerHTML = repeat === 'track' ? icons.repeatOne : icons.repeat
  el.btnRepeat.dataset.active = String(repeat !== 'off')

  const liked = player?.liked ?? false
  el.btnLike.innerHTML = liked ? icons.heartFilled : icons.heart
  el.btnLike.dataset.active = String(liked)

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

/** Rows shown in the lyrics window (design shows five). */
const WINDOW_SIZE = 5

export function renderLyrics(lines: LyricLine[], activeIndex: number): void {
  if (lines.length === 0) {
    el.lyricsList.replaceChildren(emptyMessage('No synced lyrics for this track'))
    return
  }
  const start = Math.max(0, Math.min(activeIndex - 1, lines.length - WINDOW_SIZE))
  const rows: HTMLElement[] = []
  for (let i = start; i < Math.min(start + WINDOW_SIZE, lines.length); i++) {
    const row = document.createElement('div')
    row.className = 'lyric-row'
    row.dataset.pos = i === activeIndex ? 'active' : i < activeIndex ? 'past' : 'next'

    const time = document.createElement('span')
    time.className = 'lyric-time'
    time.textContent = formatTime(lines[i].timeMs)

    const text = document.createElement('span')
    text.className = 'lyric-text'
    text.textContent = lines[i].text || '…'

    row.append(time, text)
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

export function setSyncLabel(text: string): void {
  el.lyricsState.textContent = text
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
