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
import {
  el,
  injectStaticIcons,
  showView,
  renderHeader,
  renderTransport,
  renderScrubber,
  renderLyrics,
  setLyricsVisible,
  reflectPin,
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
  opacity: 0.95,
  fontSize: 15,
  theme: 'light',
  pinned: true,
  lyricsExpanded: true
}
let dragging = false
let seekHoldUntil = 0
let ticker: ReturnType<typeof setInterval> | null = null
/** Window height (px) while lyrics are shown — restored when re-expanding. */
let lastExpandedHeight = 0

// Keep in sync with main's minWidth/minHeight so clamped drags don't drift.
const MIN_W = 372
const MIN_H = 200

const scheduler = new LyricScheduler((index) => {
  if (prefs.lyricsExpanded) renderLyrics(lines, index, lyricWindowSize())
})

// ------------------------------------------------------------------
// Sizing — the panel fills the window (minus the shadow gutter); the
// lyrics area shows as many lines as fit the current height.
// ------------------------------------------------------------------
/** How many lyric lines fit the current (resizable) lyrics area. */
function lyricWindowSize(): number {
  const perLine = prefs.fontSize * 1.32 + 9
  const available = el.lyricsPanel.clientHeight
  return Math.max(3, Math.min(11, Math.floor((available + 9) / perLine)))
}

const GUTTER = 30
const APP_PAD = 14

function topbarHeight(): number {
  return el.playerView.querySelector<HTMLElement>('.topbar')?.getBoundingClientRect().height ?? 22
}

/** Collapsed window height: everything except the lyrics area. */
function collapsedHeight(): number {
  const controls = el.playerView.querySelector<HTMLElement>('.controls')
  const ctrl = controls?.getBoundingClientRect().height ?? 60
  // GUTTER*2 (body) + APP_PAD*2 + topbar + controls margin-top + controls
  return Math.ceil(GUTTER * 2 + APP_PAD * 2 + topbarHeight() + 12 + ctrl + 4)
}

// Grow the window to fit the settings when it opens; restore on close.
let heightBeforeSettings = 0
function onSettingsToggle(): void {
  const open = !el.settingsView.hidden
  if (open) {
    void window.linea.getWindowBounds().then((b) => {
      heightBeforeSettings = b.height
      const needed = Math.ceil(
        GUTTER * 2 + APP_PAD * 2 + topbarHeight() + el.settingsView.scrollHeight
      )
      if (needed > b.height) void window.linea.resizeTo(needed)
    })
  } else if (heightBeforeSettings) {
    void window.linea.resizeTo(heightBeforeSettings)
    heightBeforeSettings = 0
  }
}

// Re-fit the lyric window as the panel is resized.
window.addEventListener('resize', () => {
  if (prefs.lyricsExpanded && lines.length > 0) scheduler.sync(lines, player)
})

// ------------------------------------------------------------------
// Custom edge/corner resize (grips sit on the panel edge, not the
// shadow — the OS border is out in the transparent gutter).
// ------------------------------------------------------------------
async function beginResize(edge: string, event: PointerEvent): Promise<void> {
  event.preventDefault()
  const b = await window.linea.getWindowBounds()
  const startX = event.screenX
  const startY = event.screenY
  let raf = 0
  let pending: { x: number; y: number; width: number; height: number } | null = null

  const flush = (): void => {
    raf = 0
    if (pending) void window.linea.setWindowBounds(pending)
  }
  const onMove = (e: PointerEvent): void => {
    const dx = e.screenX - startX
    const dy = e.screenY - startY
    let { x, y, width, height } = b
    if (edge.includes('e')) width = Math.max(MIN_W, b.width + dx)
    if (edge.includes('s')) height = Math.max(MIN_H, b.height + dy)
    if (edge.includes('w')) {
      width = Math.max(MIN_W, b.width - dx)
      x = b.x + (b.width - width)
    }
    if (edge.includes('n')) {
      height = Math.max(MIN_H, b.height - dy)
      y = b.y + (b.height - height)
    }
    pending = { x, y, width: Math.round(width), height: Math.round(height) }
    if (!raf) raf = requestAnimationFrame(flush)
  }
  const onUp = (): void => {
    window.removeEventListener('pointermove', onMove)
  }
  window.addEventListener('pointermove', onMove)
  window.addEventListener('pointerup', onUp, { once: true })
}

function wireResizeGrips(): void {
  document.querySelectorAll<HTMLElement>('.grip').forEach((grip) => {
    grip.addEventListener('pointerdown', (event) => {
      void beginResize(grip.dataset.edge ?? 'se', event)
    })
  })
}

// ------------------------------------------------------------------
// Rendering
// ------------------------------------------------------------------
function refreshPlayerUi(): void {
  renderHeader(player)
  renderTransport(player, prefs.lyricsExpanded)
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

  el.btnLyrics.addEventListener('click', () => {
    void setLyricsExpanded(!prefs.lyricsExpanded)
  })

  el.btnPin.addEventListener('click', () => {
    const pinned = !prefs.pinned
    prefs = { ...prefs, pinned }
    reflectPin(pinned)
    void window.linea.setPinned(pinned)
  })

  el.btnSettings.addEventListener('click', () => toggleSettings())

  el.btnClose.addEventListener('click', () => void window.linea.closeWindow())
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
  if (!expanded) {
    // Remember the expanded height, then shrink to just the chrome.
    const bounds = await window.linea.getWindowBounds()
    lastExpandedHeight = bounds.height
  }
  setLyricsVisible(expanded)
  renderTransport(player, expanded)
  reflectPrefs(prefs)
  await window.linea.resizeTo(expanded ? lastExpandedHeight || 260 : collapsedHeight())
  requestAnimationFrame(() => {
    if (expanded) scheduler.sync(lines, player)
  })
  await window.linea.setLyricsExpanded(expanded)
}

function applyTheme(theme: Prefs['theme']): void {
  queuePrefs({ theme })
  applyPrefsToDom(prefs)
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
  wireResizeGrips()

  el.connectBtn.addEventListener('click', () => void connect())

  initSettings({
    onTheme: applyTheme,
    onClickThrough: () => void window.linea.toggleClickThrough(),
    onOpacity: (opacity) => {
      queuePrefs({ opacity })
      applyPrefsToDom(prefs)
    },
    onFontSize: (fontSize) => {
      queuePrefs({ fontSize })
      applyPrefsToDom(prefs)
      if (prefs.lyricsExpanded) scheduler.sync(lines, player)
    },
    onLyricsExpanded: (expanded) => void setLyricsExpanded(expanded),
    onViewChange: onSettingsToggle,
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
  reflectPin(prefs.pinned)
  setLyricsVisible(prefs.lyricsExpanded)
  reflectClickThrough(clickThrough)
  el.app.dataset.clickthrough = String(clickThrough)
  setConnected(authState)
  refreshPlayerUi()

  const bounds = await window.linea.getWindowBounds()
  lastExpandedHeight = bounds.height
  // Honor a persisted collapsed state on launch.
  if (!prefs.lyricsExpanded) await window.linea.resizeTo(collapsedHeight())
}

// Keep the overlay alive: log stray errors instead of letting them
// bubble into an unhandled state that freezes the panel.
window.addEventListener('error', (event) => {
  console.error('Renderer error:', event.error ?? event.message)
})
window.addEventListener('unhandledrejection', (event) => {
  console.error('Renderer unhandled rejection:', event.reason)
})

void init()
