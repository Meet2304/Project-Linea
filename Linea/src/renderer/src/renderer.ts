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
  opacity: 0.98,
  lyricsSize: 'medium',
  theme: 'light',
  pinned: true,
  lyricsExpanded: true,
  showTimestamps: false,
  windowBounds: null
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
  else updateJumpButton()
})

// ------------------------------------------------------------------
// Sizing — the panel fills the window (minus the shadow gutter).
// ------------------------------------------------------------------
const GUTTER = 30
const APP_PAD = 12

function topbarHeight(): number {
  return el.playerView.querySelector<HTMLElement>('.topbar')?.getBoundingClientRect().height ?? 22
}

/** Window height that shows exactly the preset's line count.
 *  Controls overlay on hover (not in layout), so they aren't reserved. */
function presetWindowHeight(size: LyricsSize): number {
  const { px, lines: n } = LYRICS_PRESETS[size]
  const lineBlock = px * 1.32
  const viewport = n * lineBlock + (n - 1) * 9
  return Math.ceil(GUTTER * 2 + APP_PAD * 2 + topbarHeight() + 12 + viewport)
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

function updateJumpButton(): void {
  const active = el.lyricsList.querySelector<HTMLElement>('.lyric-row[data-pos="active"]')
  if (!active) {
    el.btnJump.hidden = true
    return
  }
  const panel = el.lyricsScroll.getBoundingClientRect()
  const row = active.getBoundingClientRect()
  const rowCenter = row.top + row.height / 2
  const mid = panel.top + panel.height / 2
  // Following again once the current line is back near the middle.
  following = Math.abs(rowCenter - mid) < panel.height * 0.3
  el.btnJump.hidden = following
  if (following) return
  // Arrow points toward the active line from the user's view.
  const dir = rowCenter < mid ? 'up' : 'down'
  el.btnJump.dataset.dir = dir
  el.btnJump.setAttribute(
    'aria-label',
    dir === 'up' ? 'Jump up to current line' : 'Jump down to current line'
  )
}

function onLyricsScroll(): void {
  updateScrollFades()
  if (autoScrolling) return
  updateJumpButton()
}

// ------------------------------------------------------------------
// Cymatic thumbnail — a small evolving standing-wave beside the title;
// pattern + hue are seeded from the track. The same jewel color drives
// active lyrics and the progress indicator via --lyric-accent.
// ------------------------------------------------------------------
const JEWELS = ['--sapphire', '--amethyst', '--teal', '--emerald', '--garnet', '--citrine'] as const
const THUMB_SPEED = 1.7 // radians/sec — evolves visibly while playing
// The thumb is per-pixel math on the CPU — ~30fps reads identically to
// 60 for a slow standing wave at half the cost.
const THUMB_FRAME_MS = 33
const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches

let thumbPhase = 0
let thumbRaf = 0
let thumbLast = 0
let thumbColor = '#3a6098'
let thumbSeed = 'linea'

function refreshThumbMeta(): void {
  thumbSeed = player?.trackId ?? 'linea'
  const token = JEWELS[hashSeed(thumbSeed) % JEWELS.length] ?? '--sapphire'
  const resolved =
    getComputedStyle(document.documentElement).getPropertyValue(token).trim() || '#3a6098'
  thumbColor = resolved
  // Keep lyric text + progress in lockstep with the dither hue.
  document.documentElement.style.setProperty('--lyric-accent', resolved)
}

function drawThumb(): void {
  renderThumb(el.thumb, thumbSeed, thumbColor, thumbPhase)
}

function thumbFrame(ts: number): void {
  thumbRaf = requestAnimationFrame(thumbFrame)
  if (!thumbLast) thumbLast = ts
  const dt = ts - thumbLast
  if (dt < THUMB_FRAME_MS) return
  thumbPhase += Math.min(0.1, dt / 1000) * THUMB_SPEED
  thumbLast = ts
  drawThumb()
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
// Resize-corner indicators — stretchy SVG arcs. The nearest corner
// fades in by proximity; its curve epoch (quadratic apex) is pulled
// toward the pointer with spring-smoothed physics. No approach pulse.
// ------------------------------------------------------------------
const CORNER_KEYS = ['nw', 'ne', 'se', 'sw'] as const
type CornerKey = (typeof CORNER_KEYS)[number]

const cornerEls = Object.fromEntries(
  CORNER_KEYS.map((k) => [k, document.querySelector<SVGSVGElement>(`.corner-${k}`)])
) as Record<CornerKey, SVGSVGElement | null>

/** Resting quadratic control point (epoch) per corner, viewBox 0–24.
 *  Arcs are 20px radius (2px inset) to match --panel-radius. */
const CORNER_REST: Record<CornerKey, [number, number]> = {
  nw: [2, 2],
  ne: [22, 2],
  se: [22, 22],
  sw: [2, 22]
}

/** Unit vector from panel center through each corner (outward bend). */
const CORNER_OUT: Record<CornerKey, [number, number]> = {
  nw: [-Math.SQRT1_2, -Math.SQRT1_2],
  ne: [Math.SQRT1_2, -Math.SQRT1_2],
  se: [Math.SQRT1_2, Math.SQRT1_2],
  sw: [-Math.SQRT1_2, Math.SQRT1_2]
}

/** Endpoints of the quarter-arc for each corner. */
const CORNER_ENDS: Record<CornerKey, [[number, number], [number, number]]> = {
  nw: [
    [2, 22],
    [22, 2]
  ],
  ne: [
    [2, 2],
    [22, 22]
  ],
  se: [
    [22, 2],
    [2, 22]
  ],
  sw: [
    [22, 22],
    [2, 2]
  ]
}

interface CornerMotion {
  opacity: number
  epochX: number
  epochY: number
  targetOpacity: number
  targetEpochX: number
  targetEpochY: number
}

function cornerPath(key: CornerKey, epochX: number, epochY: number): string {
  const [[x1, y1], [x2, y2]] = CORNER_ENDS[key]
  return `M ${x1} ${y1} Q ${epochX} ${epochY} ${x2} ${y2}`
}

function wireCornerHints(): void {
  const REACH = 110
  const PULL = 4 // max epoch travel — keep stretch inside the inset corners
  const SMOOTH = 0.22 // lerp factor per frame (~smooth spring)
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches
  const ease = reduced ? 1 : SMOOTH

  const motion = Object.fromEntries(
    CORNER_KEYS.map((key) => {
      const [rx, ry] = CORNER_REST[key]
      return [
        key,
        {
          opacity: 0,
          epochX: rx,
          epochY: ry,
          targetOpacity: 0,
          targetEpochX: rx,
          targetEpochY: ry
        } satisfies CornerMotion
      ]
    })
  ) as Record<CornerKey, CornerMotion>

  let raf = 0
  let pointerInside = false

  const paint = (): void => {
    raf = 0
    let alive = false
    for (const key of CORNER_KEYS) {
      const m = motion[key]
      const node = cornerEls[key]
      if (!node) continue
      const arc = node.querySelector('.corner-arc')
      if (!arc) continue

      m.opacity += (m.targetOpacity - m.opacity) * ease
      m.epochX += (m.targetEpochX - m.epochX) * ease
      m.epochY += (m.targetEpochY - m.epochY) * ease

      if (Math.abs(m.targetOpacity - m.opacity) > 0.004 || m.opacity > 0.01) alive = true

      node.style.opacity = String(Math.max(0, m.opacity))
      arc.setAttribute('d', cornerPath(key, m.epochX, m.epochY))
    }
    if (alive || pointerInside) raf = requestAnimationFrame(paint)
  }

  const kick = (): void => {
    if (!raf) raf = requestAnimationFrame(paint)
  }

  el.app.addEventListener('pointermove', (e) => {
    pointerInside = true
    const rect = el.app.getBoundingClientRect()
    const x = e.clientX - rect.left
    const y = e.clientY - rect.top
    const pos: Record<CornerKey, [number, number]> = {
      nw: [0, 0],
      ne: [rect.width, 0],
      se: [rect.width, rect.height],
      sw: [0, rect.height]
    }

    // Only the nearest corner within reach reacts.
    let best: CornerKey | null = null
    let bestDist = Infinity
    for (const key of CORNER_KEYS) {
      const [cx, cy] = pos[key]
      const d = Math.hypot(x - cx, y - cy)
      if (d < bestDist) {
        bestDist = d
        best = key
      }
    }

    for (const key of CORNER_KEYS) {
      const m = motion[key]
      const [rx, ry] = CORNER_REST[key]
      if (key !== best || bestDist > REACH) {
        m.targetOpacity = 0
        m.targetEpochX = rx
        m.targetEpochY = ry
        continue
      }
      const [cx, cy] = pos[key]
      const dx = x - cx
      const dy = y - cy
      const d = bestDist
      const t = Math.max(0, 1 - d / REACH)
      // Smoothstep for a gentler fade/stretch curve.
      const s = t * t * (3 - 2 * t)
      const nx = d > 0 ? dx / d : 0
      const ny = d > 0 ? dy / d : 0
      const [ox, oy] = CORNER_OUT[key]
      // Bend outward (away from center). Lateral steer from the pointer
      // so the epoch still leans toward where the cursor approaches.
      const lateral = Math.max(-1, Math.min(1, nx * -oy + ny * ox))
      m.targetOpacity = 0.15 + s * 0.75
      m.targetEpochX = rx + (ox * s + -oy * lateral * s * 0.35) * PULL
      m.targetEpochY = ry + (oy * s + ox * lateral * s * 0.35) * PULL
    }
    kick()
  })

  el.app.addEventListener('pointerleave', () => {
    pointerInside = false
    for (const key of CORNER_KEYS) {
      const m = motion[key]
      const [rx, ry] = CORNER_REST[key]
      m.targetOpacity = 0
      m.targetEpochX = rx
      m.targetEpochY = ry
    }
    kick()
  })
}

// ------------------------------------------------------------------
// Custom window drag (top bar / connect view). CSS -webkit-app-region
// drag breaks under selective setIgnoreMouseEvents for the shadow gutter,
// so placement is driven through SET_WINDOW_BOUNDS instead.
// ------------------------------------------------------------------
function isDragExcluded(target: EventTarget | null): boolean {
  return (
    target instanceof Element &&
    Boolean(target.closest('button, input, a, .grip, [data-no-drag]'))
  )
}

/** Set after a window drag/resize so the trailing `click` doesn't toggle playback. */
let suppressPlayPauseClick = false

async function beginWindowDrag(event: PointerEvent): Promise<void> {
  event.preventDefault()
  // Top bar / connect are move handles — never treat the gesture as play/pause,
  // even when the pointer barely moves (a plain click on the drag surface).
  suppressPlayPauseClick = true
  void window.linea.setPointerOverPanel(true)
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
    pending = {
      x: Math.round(b.x + (e.screenX - startX)),
      y: Math.round(b.y + (e.screenY - startY)),
      width: b.width,
      height: b.height
    }
    if (!raf) raf = requestAnimationFrame(flush)
  }
  const onUp = (): void => {
    window.removeEventListener('pointermove', onMove)
    void window.linea.setPointerOverPanel(el.app.matches(':hover'))
    // Safety clear so a missed click can't swallow the next lyrics tap.
    // Long enough that the trailing `click` (if any) still sees the flag.
    window.setTimeout(() => {
      suppressPlayPauseClick = false
    }, 50)
  }
  window.addEventListener('pointermove', onMove)
  window.addEventListener('pointerup', onUp, { once: true })
}

function wireWindowDrag(handle: HTMLElement): void {
  handle.addEventListener('pointerdown', (event) => {
    if (event.button !== 0) return
    if (isDragExcluded(event.target)) return
    void beginWindowDrag(event)
  })
}

// ------------------------------------------------------------------
// Custom edge/corner resize (grips sit on the panel edge, not the
// shadow — the OS border is out in the transparent gutter).
// ------------------------------------------------------------------
async function beginResize(edge: string, event: PointerEvent): Promise<void> {
  event.preventDefault()
  suppressPlayPauseClick = true
  // Keep the window capturing mouse for the whole drag, even if the cursor
  // leaves the panel into the transparent gutter.
  void window.linea.setPointerOverPanel(true)
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
    void window.linea.setPointerOverPanel(el.app.matches(':hover'))
    window.setTimeout(() => {
      suppressPlayPauseClick = false
    }, 50)
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
  renderTransport(player)
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

function togglePlayPause(): void {
  if (!connected || !player || el.playerView.hidden) return
  // Settings occupies the same surface — don't hijack its clicks.
  if (!el.settingsView.hidden) return
  const wasPlaying = player.isPlaying
  void sendCommand(
    { type: wasPlaying ? 'pause' : 'play' },
    () => {
      if (!player) return
      anchorPosition()
      player = { ...player, isPlaying: !wasPlaying }
    },
    () => {
      if (player) player = { ...player, isPlaying: wasPlaying }
    }
  )
}

function wireTransport(): void {
  el.btnPlay.addEventListener('click', (event) => {
    event.stopPropagation()
    togglePlayPause()
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

  el.btnPin.addEventListener('click', () => {
    const pinned = !prefs.pinned
    prefs = { ...prefs, pinned }
    reflectPin(pinned)
    void window.linea.setPinned(pinned)
  })

  el.btnSettings.addEventListener('click', () => toggleSettings())

  el.btnClose.addEventListener('click', () => void window.linea.closeWindow())

  // Click lyrics / empty chrome to play or pause — never the drag handles
  // (top bar / connect) or real controls, and never after a move/resize.
  el.app.addEventListener('click', (event) => {
    if (suppressPlayPauseClick) {
      suppressPlayPauseClick = false
      return
    }
    const target = event.target
    if (!(target instanceof Element)) return
    if (
      target.closest(
        'button, input, a, label, .grip, .corner, .switch, .segmented, .theme-toggle, #settings-view, .controls, .topbar, .connect'
      )
    ) {
      return
    }
    togglePlayPause()
  })

  el.lyricsScroll.addEventListener('scroll', onLyricsScroll)
  // Slightly amplify wheel so short flicks move through lyrics more easily
  // in the compact overlay. Ctrl/pinch-zoom is left alone.
  el.lyricsScroll.addEventListener(
    'wheel',
    (event) => {
      if (event.ctrlKey || event.deltaY === 0) return
      event.preventDefault()
      const scale = event.deltaMode === WheelEvent.DOM_DELTA_LINE ? 22 : 1.45
      el.lyricsScroll.scrollTop += event.deltaY * scale
    },
    { passive: false }
  )
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

function applyTheme(theme: Prefs['theme']): void {
  queuePrefs({ theme })
  applyPrefsToDom(prefs)
  updateThumb()
}

function applyLyricsSize(size: LyricsSize): void {
  queuePrefs({ lyricsSize: size })
  applyPrefsToDom(prefs)
  const h = presetWindowHeight(size)
  lastExpandedHeight = h
  void window.linea.resizeTo(h)
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
      void window.linea.resizeTo(lastExpandedHeight)
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

  const topbar = el.playerView.querySelector<HTMLElement>('.topbar')
  if (topbar) wireWindowDrag(topbar)
  wireWindowDrag(el.connectView)

  el.connectBtn.addEventListener('click', () => void connect())

  initSettings({
    onTheme: applyTheme,
    onClickThrough: () => void window.linea.toggleClickThrough(),
    onLyricsSize: applyLyricsSize,
    onShowTimestamps: (show) => {
      queuePrefs({ showTimestamps: show })
      applyPrefsToDom(prefs)
    },
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

  window.linea.onWindowFocusChanged(setWindowFocused)
  window.addEventListener('blur', () => setWindowFocused(false))
  window.addEventListener('focus', () => setWindowFocused(true))

  // Drive chrome from real pointer enter/leave (not CSS :hover), so controls
  // appear on hover without a click, and clear cleanly when focus leaves.
  // Also tell main whether to capture mouse — the shadow gutter must stay
  // click-through so desktop items under it remain interactive.
  el.app.addEventListener('pointerenter', () => {
    setPointerInside(true)
    void window.linea.setPointerOverPanel(true)
  })
  el.app.addEventListener('pointerleave', () => {
    setPointerInside(false)
    void window.linea.setPointerOverPanel(false)
  })

  window.linea.onPlayerError((event) => toastForReason(event.reason))

  // Both views start hidden, so a rejection here would paint an empty panel
  // with no way back. Fall back to defaults and show the connect view — a
  // reachable "Connect Spotify" beats a blank rectangle.
  let loadedPrefs = prefs
  let authState = false
  let clickThrough = false
  try {
    ;[loadedPrefs, authState, clickThrough] = await Promise.all([
      window.linea.getPrefs(),
      window.linea.getAuthState(),
      window.linea.getClickThroughState()
    ])
  } catch (error) {
    console.error('Startup state unavailable — falling back to defaults:', error)
  }

  prefs = loadedPrefs
  applyPrefsToDom(prefs)
  reflectPrefs(prefs)
  reflectPin(prefs.pinned)
  setLyricsVisible()
  reflectClickThrough(clickThrough)
  el.app.dataset.clickthrough = String(clickThrough)
  setWindowFocused(document.hasFocus())
  const hovering = el.app.matches(':hover')
  setPointerInside(hovering)
  void window.linea.setPointerOverPanel(hovering)
  setConnected(authState)
  refreshPlayerUi()
}

/** Hover chrome — explicit flag so we can clear stuck :hover on blur. */
function setPointerInside(inside: boolean): void {
  el.app.dataset.pointerInside = String(inside)
}

/** When focus leaves Linea, drop hover chrome even if the cursor still rests here.
 *  Mouse capture stays tied to real pointerenter/leave — not focus — so the
 *  panel remains interactive while the cursor is over it. */
function setWindowFocused(focused: boolean): void {
  el.app.dataset.windowFocus = String(focused)
  if (!focused) {
    setPointerInside(false)
    const active = document.activeElement
    if (active instanceof HTMLElement && active !== document.body) active.blur()
  } else if (el.app.matches(':hover')) {
    setPointerInside(true)
  }
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
