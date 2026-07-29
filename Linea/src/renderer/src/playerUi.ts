import { icons } from './icons'
import { formatTime, formatRemaining } from '../../shared/format'
import type { LyricsSize, PlayerState, Prefs } from '../../shared/types'
import type { LyricLine, LyricsStatus } from '../../shared/lyrics'

function byId<T extends HTMLElement>(id: string): T {
  const node = document.getElementById(id)
  if (!node) throw new Error(`Missing element #${id}`)
  return node as T
}

/** Each size preset pairs a font size with a default visible-line count. */
export const LYRICS_PRESETS: Record<LyricsSize, { px: number; lines: number }> = {
  small: { px: 13, lines: 6 },
  medium: { px: 15, lines: 5 },
  large: { px: 18, lines: 3 }
}

export const el = {
  app: byId('app'),
  thumb: byId<HTMLCanvasElement>('thumb'),
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
  btnUpdate: byId<HTMLButtonElement>('btn-update'),
  btnPin: byId<HTMLButtonElement>('btn-pin'),
  btnSettings: byId<HTMLButtonElement>('btn-settings'),
  btnClose: byId<HTMLButtonElement>('btn-close'),
  nowView: byId('now-view'),
  settingsView: byId('settings-view'),
  lyricsPanel: byId('lyrics-panel'),
  lyricsScroll: byId('lyrics-scroll'),
  lyricsList: byId('lyrics-list'),
  btnJump: byId<HTMLButtonElement>('btn-jump'),
  updateTitle: byId('update-title'),
  updateHint: byId('update-hint'),
  updateAction: byId<HTMLButtonElement>('update-action'),
  updateProgress: byId('update-progress'),
  toast: byId('toast')
}

export function injectStaticIcons(): void {
  el.btnShuffle.innerHTML = icons.shuffle
  el.btnPrev.innerHTML = icons.skipBack
  el.btnNext.innerHTML = icons.skipForward
  el.btnUpdate.innerHTML = icons.update
  el.btnPin.innerHTML = icons.pin
  el.btnSettings.innerHTML = icons.cog
  el.btnClose.innerHTML = icons.x
  const jumpDir = el.btnJump.querySelector('.jump-dir')
  if (jumpDir) jumpDir.innerHTML = icons.chevronDown
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

export function renderTransport(player: PlayerState | null): void {
  const playing = player?.isPlaying ?? false
  el.btnPlay.innerHTML = playing ? icons.pause : icons.play

  el.btnShuffle.dataset.active = String(player?.shuffle ?? false)

  const repeat = player?.repeat ?? 'off'
  el.btnRepeat.innerHTML = repeat === 'track' ? icons.repeatOne : icons.repeat
  el.btnRepeat.dataset.active = String(repeat !== 'off')
}

export function renderScrubber(positionMs: number, durationMs: number): void {
  const ratio = durationMs > 0 ? Math.min(1, Math.max(0, positionMs / durationMs)) : 0
  el.seek.value = String(Math.round(ratio * 1000))
  el.seek.style.setProperty('--fill', String(ratio * 100))
  el.app.style.setProperty('--song-progress', String(ratio))
  el.timeElapsed.textContent = formatTime(positionMs)
  el.timeRemaining.textContent = formatRemaining(durationMs, positionMs)
}

/** Cached row elements so per-boundary updates never re-query the DOM. */
let lyricRows: HTMLElement[] = []

/** Build every lyric line once; the container scrolls and the active
 *  line is tracked separately via setActiveLyric(). */
export function renderAllLyrics(lines: LyricLine[], status: LyricsStatus = 'none'): void {
  if (lines.length === 0) {
    lyricRows = []
    // Only claim the track has no lyrics when lrclib actually said so.
    // If the lookup never completed we know nothing about the track, and
    // saying otherwise sends people hunting for a bug in the app.
    el.lyricsList.replaceChildren(
      emptyMessage(
        status === 'unreachable'
          ? "Can't reach the lyrics service — check your connection"
          : 'No synced lyrics for this track'
      )
    )
    return
  }
  const rows = lines.map((line, i) => {
    const row = document.createElement('div')
    row.className = 'lyric-row'
    row.dataset.index = String(i)
    row.dataset.pos = 'next'

    const time = document.createElement('span')
    time.className = 'lyric-time mono'
    time.textContent = formatTime(line.timeMs)

    const text = document.createElement('span')
    text.className = 'lyric-text'
    text.textContent = line.text || '…'

    row.append(time, text)
    return row
  })
  lyricRows = rows
  el.lyricsList.replaceChildren(...rows)
}

/** Mark past/active/next on the already-rendered rows. Only rows whose
 *  position actually changed are written, so a typical boundary touches
 *  two elements instead of restyling the whole list. */
export function setActiveLyric(index: number): void {
  for (let i = 0; i < lyricRows.length; i++) {
    const pos = i === index ? 'active' : i < index ? 'past' : 'next'
    const row = lyricRows[i]
    if (row && row.dataset.pos !== pos) row.dataset.pos = pos
  }
}

function emptyMessage(text: string): HTMLElement {
  const div = document.createElement('div')
  div.className = 'lyrics-empty'
  div.textContent = text
  return div
}

export function setLyricsVisible(): void {
  el.lyricsPanel.hidden = false
  // Drives hover-reveal controls CSS (`#app[data-lyrics='true']`).
  el.app.dataset.lyrics = 'true'
}

export function applyPrefsToDom(prefs: Prefs): void {
  document.documentElement.dataset.theme = prefs.theme
  document.documentElement.style.setProperty('--panel-alpha', String(prefs.opacity))
  // How “clear” the shell is — drives readable text/glass treatments.
  document.documentElement.style.setProperty('--panel-clearance', String(1 - prefs.opacity))
  document.documentElement.style.setProperty(
    '--lyrics-size',
    `${LYRICS_PRESETS[prefs.lyricsSize].px}px`
  )
  el.app.dataset.timestamps = String(prefs.showTimestamps)
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
