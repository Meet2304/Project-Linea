import '@fontsource/outfit/300.css'
import '@fontsource/outfit/400.css'
import '@fontsource/outfit/500.css'
import '@fontsource/outfit/600.css'
import '@fontsource/outfit/700.css'
import '@fontsource/space-mono/400.css'
import '@fontsource/space-mono/700.css'

import { estimatePositionMs } from '../../shared/lyrics'
import type { LyricLine } from '../../shared/lyrics'
import type {
  LyricsSize,
  PlayerCommand,
  PlayerErrorReason,
  PlayerState,
  Prefs
} from '../../shared/types'
import { renderThumb, hashSeed } from './cymatics'
import {
  el,
  LYRICS_PRESETS,
  injectStaticIcons,
  showView,
  renderHeader,
  renderTransport,
  renderScrubber,
  renderAllLyrics,
  setActiveLyric,
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
  lyricsSize: 'medium',
  theme: 'light',
  pinned: true,
  lyricsExpanded: true
}
let dragging = false
let seekHoldUntil = 0
let ticker: ReturnType<typeof setInterval> | null = null
/** Window height (px) while lyrics are shown — restored when re-expanding. */
let lastExpandedHeight = 0
/** Whether the lyrics view auto-follows the current line (vs. free reading). */
let following = true
let autoScrolling = false
let autoScrollTimer: ReturnType<typeof setTimeout> | null = null

// Keep in sync with main's minWidth/minHeight so clamped drags don't drift.
const MIN_W = 372
const MIN_H = 150

const scheduler = new LyricScheduler((index) => {
  setActiveLyric(index)
  if (following) centerActiveLyric(false)
})

// ------------------------------------------------------------------
// Sizing — the panel fills the window (minus the shadow gutter).
// ------------------------------------------------------------------
const GUTTER = 30
const APP_PAD = 14

function topbarHeight(): number {
  return el.playerView.querySelector<HTMLElement>('.topbar')?.getBoundingClientRect().height ?? 22
}

function controlsHeight(): number {
  return el.playerView.querySelector<HTMLElement>('.controls')?.getBoundingClientRect().height ?? 60
}

/** Collapsed window height: everything except the lyrics area. */
function collapsedHeight(): number {
  // GUTTER*2 (body) + APP_PAD*2 + topbar + controls margin-top + controls
  return Math.ceil(GUTTER * 2 + APP_PAD * 2 + topbarHeight() + 12 + controlsHeight() + 4)
}

/** Window height that shows exactly the preset's line count. */
function presetWindowHeight(size: LyricsSize): number {
  const { px, lines: n } = LYRICS_PRESETS[size]
  const lineBlock = px * 1.32
  const viewport = n * lineBlock + (n - 1) * 9
  return Math.ceil(
    GUTTER * 2 + APP_PAD * 2 + topbarHeight() + 12 + viewport + 12 + controlsHeight()
  )
}

// ------------------------------------------------------------------
// Lyrics scrolling — the list is fully scrollable; while "following"
// the active line stays centered, and a jump button re-centers it.
// ------------------------------------------------------------------
/** Pad the list top/bottom so any line (including the first/last) can
 *  scroll to the vertical center. */
function updateLyricPadding(): void {
  const pad = Math.max(24, Math.round(el.lyricsScroll.clientHeight / 2 - 16))
  el.lyricsList.style.paddingTop = `${pad}px`
  el.lyricsList.style.paddingBottom = `${pad}px`
}

function centerActiveLyric(smooth: boolean): void {
  const active = el.lyricsList.querySelector<HTMLElement>('.lyric-row[data-pos="active"]')
  if (!active) return
  const panel = el.lyricsScroll.getBoundingClientRect()
  const row = active.getBoundingClientRect()
  const delta = row.top - panel.top - (panel.height - row.height) / 2
  autoScrolling = true
  el.lyricsScroll.scrollTo({
    top: el.lyricsScroll.scrollTop + delta,
    behavior: smooth ? 'smooth' : 'auto'
  })
  if (autoScrollTimer) clearTimeout(autoScrollTimer)
  autoScrollTimer = setTimeout(() => (autoScrolling = false), smooth ? 450 : 60)
}

/** Top/bottom fade cues so it's obvious the lyrics scroll. */
function updateScrollFades(): void {
  const s = el.lyricsScroll
  el.lyricsPanel.dataset.up = String(s.scrollTop > 2)
  el.lyricsPanel.dataset.down = String(s.scrollTop + s.clientHeight < s.scrollHeight - 2)
}

function onLyricsScroll(): void {
  updateScrollFades()
  if (autoScrolling) return
  const active = el.lyricsList.querySelector<HTMLElement>('.lyric-row[data-pos="active"]')
  if (!active) {
    el.btnJump.hidden = true
    return
  }
  const panel = el.lyricsScroll.getBoundingClientRect()
  const row = active.getBoundingClientRect()
  const rowCenter = row.top + row.height / 2
  // Following again once the current line is back near the middle.
  following = Math.abs(rowCenter - (panel.top + panel.height / 2)) < panel.height * 0.3
  el.btnJump.hidden = following
}

// ------------------------------------------------------------------
// Cymatic thumbnail — a small evolving standing-wave beside the title;
// pattern seeded from the track, hue a per-track jewel.
// ------------------------------------------------------------------
const JEWELS = ['--sapphire', '--amethyst', '--teal', '--emerald', '--garnet', '--citrine']
const THUMB_SPEED = 1.7 // radians/sec — evolves visibly while playing
const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches

let thumbPhase = 0
let thumbRaf = 0
let thumbLast = 0
let thumbColor = '#3a6098'
let thumbSeed = 'linea'

function refreshThumbMeta(): void {
  thumbSeed = player?.trackId ?? 'linea'
  const name = JEWELS[hashSeed(thumbSeed) % JEWELS.length]
  thumbColor = getComputedStyle(document.documentElement).getPropertyValue(name).trim() || '#3a6098'
}

function drawThumb(): void {
  renderThumb(el.thumb, thumbSeed, thumbColor, thumbPhase)
}

function thumbFrame(ts: number): void {
  if (!thumbLast) thumbLast = ts
  thumbPhase += Math.min(0.1, (ts - thumbLast) / 1000) * THUMB_SPEED
  thumbLast = ts
  drawThumb()
  thumbRaf = requestAnimationFrame(thumbFrame)
}

/** Animate only while a track is playing; otherwise hold a still frame. */
function updateThumb(): void {
  refreshThumbMeta()
  const playing = connected && (player?.isPlaying ?? false)
  if (playing && !reducedMotion) {
    if (!thumbRaf) {
      thumbLast = 0
      thumbRaf = requestAnimationFrame(thumbFrame)
    }
  } else {
    if (thumbRaf) {
      cancelAnimationFrame(thumbRaf)
      thumbRaf = 0
    }
    drawThumb()
  }
}

window.addEventListener('resize', () => {
  updateLyricPadding()
  updateScrollFades()
  if (following) centerActiveLyric(false)
})

// ------------------------------------------------------------------
// Resize-corner indicators — the nearest corner reacts to the pointer:
// it fades in by proximity, is magnetically pulled toward the cursor,
// and pulses once on approach.
// ------------------------------------------------------------------
const CORNER_KEYS = ['nw', 'ne', 'se', 'sw'] as const
const cornerEls = Object.fromEntries(
  CORNER_KEYS.map((k) => [k, document.querySelector<HTMLElement>(`.corner-${k}`)])
) as Record<(typeof CORNER_KEYS)[number], HTMLElement>

function wireCornerHints(): void {
  const R = 100
  el.app.addEventListener('pointermove', (e) => {
    const rect = el.app.getBoundingClientRect()
    const x = e.clientX - rect.left
    const y = e.clientY - rect.top
    const pos: Record<string, [number, number]> = {
      nw: [0, 0],
      ne: [rect.width, 0],
      se: [rect.width, rect.height],
      sw: [0, rect.height]
    }
    for (const key of CORNER_KEYS) {
      const node = cornerEls[key]
      if (!node) continue
      const [cx, cy] = pos[key]
      const dx = x - cx
      const dy = y - cy
      const d = Math.hypot(dx, dy)
      const t = Math.max(0, 1 - d / R)
      if (t <= 0.02) {
        node.style.opacity = '0'
        node.dataset.near = 'false'
        continue
      }
      const nx = d > 0 ? dx / d : 0
      const ny = d > 0 ? dy / d : 0
      node.style.opacity = String(0.2 + t * 0.6)
      node.style.transform = `translate(${nx * t * 3}px, ${ny * t * 3}px) scale(${0.82 + t * 0.5})`
      if (node.dataset.near !== 'true') {
        node.dataset.near = 'true'
        node.classList.remove('pulse')
        void node.offsetWidth // restart the one-shot pulse
        node.classList.add('pulse')
      }
    }
  })
  el.app.addEventListener('pointerleave', () => {
    for (const key of CORNER_KEYS) {
      const node = cornerEls[key]
      if (!node) continue
      node.style.opacity = '0'
      node.dataset.near = 'false'
    }
  })
}

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
  updateThumb()
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

  el.lyricsScroll.addEventListener('scroll', onLyricsScroll)
  el.btnJump.addEventListener('click', () => {
    following = true
    el.btnJump.hidden = true
    centerActiveLyric(true)
  })
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
    // Remember the current (expanded) height so re-expanding restores it.
    const bounds = await window.linea.getWindowBounds()
    lastExpandedHeight = bounds.height
  }
  setLyricsVisible(expanded)
  renderTransport(player, expanded)
  reflectPrefs(prefs)
  void window.linea.setLyricsExpanded(expanded)
  // Resize AFTER the layout reflects the new visibility, so the collapsed
  // measurement is exact and the window hugs the chrome (no empty gap).
  requestAnimationFrame(() => {
    const target = expanded
      ? lastExpandedHeight || presetWindowHeight(prefs.lyricsSize)
      : collapsedHeight()
    void window.linea.resizeTo(target)
    requestAnimationFrame(() => {
      updateLyricPadding()
      updateScrollFades()
      if (expanded) {
        following = true
        el.btnJump.hidden = true
        scheduler.sync(lines, player)
        centerActiveLyric(false)
      }
    })
  })
}

function applyTheme(theme: Prefs['theme']): void {
  queuePrefs({ theme })
  applyPrefsToDom(prefs)
  updateThumb()
}

function applyLyricsSize(size: LyricsSize): void {
  queuePrefs({ lyricsSize: size })
  applyPrefsToDom(prefs)
  if (prefs.lyricsExpanded) {
    const h = presetWindowHeight(size)
    lastExpandedHeight = h
    void window.linea.resizeTo(h)
  }
  requestAnimationFrame(() => {
    updateLyricPadding()
    updateScrollFades()
    if (following) centerActiveLyric(false)
  })
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
  if (isConnected) {
    // Player view is now visible and measurable — size to the preset.
    requestAnimationFrame(() => {
      lastExpandedHeight = presetWindowHeight(prefs.lyricsSize)
      void window.linea.resizeTo(prefs.lyricsExpanded ? lastExpandedHeight : collapsedHeight())
      requestAnimationFrame(() => {
        updateLyricPadding()
        updateScrollFades()
        centerActiveLyric(false)
        updateThumb()
      })
    })
  } else {
    updateThumb()
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
  wireCornerHints()

  el.connectBtn.addEventListener('click', () => void connect())

  initSettings({
    onTheme: applyTheme,
    onClickThrough: () => void window.linea.toggleClickThrough(),
    onOpacity: (opacity) => {
      queuePrefs({ opacity })
      applyPrefsToDom(prefs)
    },
    onLyricsSize: applyLyricsSize,
    onLyricsExpanded: (expanded) => void setLyricsExpanded(expanded),
    onViewChange: () => {},
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
    renderAllLyrics(newLines)
    following = true
    el.btnJump.hidden = true
    scheduler.sync(lines, player)
    requestAnimationFrame(() => {
      updateLyricPadding()
      updateScrollFades()
      centerActiveLyric(false)
    })
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
