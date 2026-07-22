import '@fontsource/outfit/300.css'
import '@fontsource/outfit/400.css'
import '@fontsource/outfit/500.css'
import '@fontsource/outfit/600.css'
import '@fontsource/outfit/700.css'
import '@fontsource/space-mono/400.css'
import '@fontsource/space-mono/700.css'

import { estimatePositionMs } from '../../shared/lyrics'
import type { LyricLine } from '../../shared/lyrics'
import type { PlayerCommand, PlayerErrorReason, PlayerState, Prefs } from '../../shared/types'
import { renderTrackArt, clearArtCache } from './cymatics'
import {
  el,
  injectStaticIcons,
  showView,
  renderHeader,
  renderTransport,
  renderScrubber,
  renderLyrics,
  setLyricsVisible,
  setSyncLabel,
  applyPrefsToDom,
  showToast
} from './playerUi'
import { LyricScheduler } from './scheduler'
import {
  initSettings,
  reflectPrefs,
  reflectClickThrough,
  toggleSettings,
  closeSettings
} from './settingsUi'

// ------------------------------------------------------------------
// State
// ------------------------------------------------------------------
let connected = false
let player: PlayerState | null = null
let lines: LyricLine[] = []
let prefs: Prefs = {
  opacity: 0.92,
  fontSize: 14,
  theme: 'light',
  pinned: true,
  lyricsExpanded: true
}
let renderedArtKey = ''
let dragging = false
let seekHoldUntil = 0
let ticker: ReturnType<typeof setInterval> | null = null

const scheduler = new LyricScheduler((index) => {
  if (prefs.lyricsExpanded) renderLyrics(lines, index)
})

// ------------------------------------------------------------------
// Rendering
// ------------------------------------------------------------------
function refreshArt(): void {
  if (!player?.trackId) {
    renderedArtKey = ''
    const ctx = el.art.getContext('2d')
    ctx?.clearRect(0, 0, el.art.width, el.art.height)
    return
  }
  const key = `${player.trackId}:${prefs.theme}`
  if (key === renderedArtKey) return
  const color = getComputedStyle(document.documentElement).getPropertyValue('--teal').trim()
  renderTrackArt(el.art, player.trackId, prefs.theme, color || '#2f7d7a')
  renderedArtKey = key
}

function refreshPlayerUi(): void {
  renderHeader(player)
  renderTransport(player, prefs.lyricsExpanded)
  refreshArt()
  if (player) {
    renderScrubber(estimatePositionMs(player), player.durationMs)
  } else {
    renderScrubber(0, 0)
  }
  el.seek.disabled = !player
  scheduler.sync(lines, player)
  updateTicker()
}

function tick(): void {
  if (!player || dragging) return
  renderScrubber(estimatePositionMs(player), player.durationMs)
}

function updateTicker(): void {
  const shouldRun = connected && (player?.isPlaying ?? false)
  if (shouldRun && ticker === null) ticker = setInterval(tick, 500)
  if (!shouldRun && ticker !== null) {
    clearInterval(ticker)
    ticker = null
  }
}

function toastForReason(reason: PlayerErrorReason): void {
  const messages: Record<PlayerErrorReason, string> = {
    premium_required: 'Spotify Premium is required for playback controls',
    no_device: 'No active Spotify device — start playback on a device first',
    rate_limited: 'Spotify is rate-limiting requests — try again shortly',
    auth_expired: 'Spotify session expired — reconnect in settings',
    insufficient_scope: 'Reconnect Spotify to enable playback controls',
    network: 'Could not reach Spotify'
  }
  showToast(messages[reason])
}

// ------------------------------------------------------------------
// Commands (optimistic apply → invoke → revert on failure)
// ------------------------------------------------------------------
async function sendCommand(
  cmd: PlayerCommand,
  optimistic?: () => void,
  revert?: () => void
): Promise<void> {
  optimistic?.()
  refreshPlayerUi()
  const result = await window.linea.playerCommand(cmd)
  if (!result.ok) {
    revert?.()
    refreshPlayerUi()
    toastForReason(result.reason)
  }
}

function anchorPosition(): void {
  if (!player) return
  player = { ...player, progressMs: estimatePositionMs(player), fetchedAt: Date.now() }
}

function wireTransport(): void {
  el.btnPlay.addEventListener('click', () => {
    const wasPlaying = player?.isPlaying ?? false
    void sendCommand(
      { type: wasPlaying ? 'pause' : 'play' },
      () => {
        if (!player) return
        anchorPosition()
        player = { ...player!, isPlaying: !wasPlaying }
      },
      () => {
        if (player) player = { ...player, isPlaying: wasPlaying }
      }
    )
  })

  el.btnNext.addEventListener('click', () => void sendCommand({ type: 'next' }))
  el.btnPrev.addEventListener('click', () => void sendCommand({ type: 'previous' }))

  el.btnShuffle.addEventListener('click', () => {
    const was = player?.shuffle ?? false
    void sendCommand(
      { type: 'shuffle', state: !was },
      () => {
        if (player) player = { ...player, shuffle: !was }
      },
      () => {
        if (player) player = { ...player, shuffle: was }
      }
    )
  })

  el.btnRepeat.addEventListener('click', () => {
    const was = player?.repeat ?? 'off'
    const next = was === 'off' ? 'context' : was === 'context' ? 'track' : 'off'
    void sendCommand(
      { type: 'repeat', mode: next },
      () => {
        if (player) player = { ...player, repeat: next }
      },
      () => {
        if (player) player = { ...player, repeat: was }
      }
    )
  })

  el.btnLike.addEventListener('click', async () => {
    if (!player?.trackId) return
    const was = player.liked ?? false
    player = { ...player, liked: !was }
    refreshPlayerUi()
    const result = await window.linea.toggleLike()
    if (!result.ok) {
      if (player) player = { ...player, liked: was }
      refreshPlayerUi()
      toastForReason(result.reason)
    }
  })

  el.btnLyrics.addEventListener('click', () => {
    void setLyricsExpanded(!prefs.lyricsExpanded)
  })

  el.btnSettings.addEventListener('click', () => toggleSettings())
}

function wireSeek(): void {
  el.seek.addEventListener('input', () => {
    dragging = true
    if (!player) return
    const positionMs = (Number(el.seek.value) / 1000) * player.durationMs
    el.seek.style.setProperty('--fill', String(Number(el.seek.value) / 10))
    renderScrubber(positionMs, player.durationMs)
  })
  el.seek.addEventListener('change', () => {
    dragging = false
    if (!player) return
    const positionMs = Math.round((Number(el.seek.value) / 1000) * player.durationMs)
    seekHoldUntil = Date.now() + 1200
    void sendCommand({ type: 'seek', positionMs }, () => {
      if (player) player = { ...player, progressMs: positionMs, fetchedAt: Date.now() }
    })
  })
}

// ------------------------------------------------------------------
// Prefs
// ------------------------------------------------------------------
const pendingPrefs: Partial<Prefs> = {}
let prefsTimer: ReturnType<typeof setTimeout> | null = null

/** Apply instantly, persist on a trailing debounce (fewer disk writes). */
function queuePrefs(partial: Partial<Prefs>): void {
  Object.assign(pendingPrefs, partial)
  prefs = { ...prefs, ...partial }
  if (prefsTimer) clearTimeout(prefsTimer)
  prefsTimer = setTimeout(() => {
    const toSave = { ...pendingPrefs }
    for (const key of Object.keys(pendingPrefs)) delete pendingPrefs[key as keyof Prefs]
    prefsTimer = null
    void window.linea.setPrefs(toSave)
  }, 300)
}

async function setLyricsExpanded(expanded: boolean): Promise<void> {
  prefs = { ...prefs, lyricsExpanded: expanded }
  setLyricsVisible(expanded)
  renderTransport(player, expanded)
  reflectPrefs(prefs)
  scheduler.sync(lines, player)
  await window.linea.setLyricsExpanded(expanded)
}

function applyTheme(theme: Prefs['theme']): void {
  queuePrefs({ theme })
  applyPrefsToDom(prefs)
  clearArtCache()
  renderedArtKey = ''
  refreshArt()
}

// ------------------------------------------------------------------
// Auth
// ------------------------------------------------------------------
function setConnected(isConnected: boolean): void {
  connected = isConnected
  showView(isConnected ? 'player' : 'connect')
  if (!isConnected) {
    player = null
    lines = []
    closeSettings()
    scheduler.stop()
    updateTicker()
  }
}

async function connect(): Promise<void> {
  try {
    el.connectBtn.disabled = true
    el.connectStatus.textContent = 'Waiting for Spotify…'
    const ok = await window.linea.login()
    el.connectStatus.textContent = ''
    setConnected(ok)
  } catch (error) {
    el.connectStatus.textContent = error instanceof Error ? error.message : 'Login failed'
  } finally {
    el.connectBtn.disabled = false
  }
}

// ------------------------------------------------------------------
// Init
// ------------------------------------------------------------------
async function init(): Promise<void> {
  injectStaticIcons()
  wireTransport()
  wireSeek()

  el.connectBtn.addEventListener('click', () => void connect())

  initSettings({
    onTheme: applyTheme,
    onPin: (pinned) => {
      prefs = { ...prefs, pinned }
      void window.linea.setPinned(pinned)
    },
    onClickThrough: () => void window.linea.toggleClickThrough(),
    onOpacity: (opacity) => {
      queuePrefs({ opacity })
      applyPrefsToDom(prefs)
    },
    onFontSize: (fontSize) => {
      queuePrefs({ fontSize })
      applyPrefsToDom(prefs)
    },
    onLyricsExpanded: (expanded) => void setLyricsExpanded(expanded),
    onDisconnect: () => {
      void window.linea.logout().then(() => setConnected(false))
    }
  })

  window.linea.onNowPlaying((data) => {
    if (data && player && Date.now() < seekHoldUntil) {
      // A seek was just issued — keep the optimistic position until
      // Spotify's eventually-consistent progress catches up.
      player = { ...data, progressMs: player.progressMs, fetchedAt: player.fetchedAt }
    } else {
      player = data
    }
    refreshPlayerUi()
  })

  window.linea.onLyricsUpdate((newLines) => {
    lines = newLines
    setSyncLabel(newLines.length > 0 ? 'Synced' : 'No lyrics')
    if (newLines.length === 0) renderLyrics([], -1)
    scheduler.sync(lines, player)
  })

  window.linea.onClickThroughChanged((on) => {
    reflectClickThrough(on)
    el.app.dataset.clickthrough = String(on)
  })

  window.linea.onPlayerError((event) => toastForReason(event.reason))

  const [loadedPrefs, authState, clickThrough] = await Promise.all([
    window.linea.getPrefs(),
    window.linea.getAuthState(),
    window.linea.getClickThroughState()
  ])

  prefs = loadedPrefs
  applyPrefsToDom(prefs)
  reflectPrefs(prefs)
  setLyricsVisible(prefs.lyricsExpanded)
  reflectClickThrough(clickThrough)
  el.app.dataset.clickthrough = String(clickThrough)
  setConnected(authState)
  refreshPlayerUi()
}

void init()
