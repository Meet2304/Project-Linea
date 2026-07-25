/* ============================================================
   LINEA — CYMATICS LIVE
   TypeScript port of the design system's assets/cymatics-live.js.
   Real-time cousin of the app's src/renderer/src/cymatics.ts: the
   same 8x8 ordered (Bayer) dither over white, the same single-color
   grain — but time-varying and pointer-reactive.

   Renders into a small offscreen buffer each frame and scales it up
   with smoothing off, so the halftone stays crisp while the field
   stays cheap enough for rAF.

   Additions over the design-project original, because this page
   carries several fields at once:
     - the loop parks itself when the host element is off-screen or
       the tab is hidden;
     - prefers-reduced-motion renders a single still frame and stops,
       with pointer reactivity disabled.
   ============================================================ */

export type FieldStyle = 'chladni' | 'radial' | 'flow' | 'ripple' | 'lattice'

export interface FieldOptions {
  style?: FieldStyle
  /** Primary color, hex. */
  color?: string
  /** Optional second color — the field sweeps color → color2 diagonally. */
  color2?: string
  density?: number
  /** 0 smooth … 1 heavy grain. */
  dither?: number
  scale?: number
  seed?: number
  opacity?: number
  /** Radial vignette toward the edges. */
  fade?: boolean
  /** Chladni/radial modal numbers. Derived from `density` when omitted. */
  n?: number
  m?: number
  /** Pointer influence strength; 0 disables it. */
  ptAmt?: number
  /**
   * How fast the plate itself breathes. This is the "music is playing"
   * clock — raise it to make the field feel alive.
   */
  speed?: number
  /**
   * How fast the ring pulsing out of the cursor travels, as its own clock.
   * Deliberately independent of `speed`: the field wants to move, the
   * pointer response wants to stay slow and unhurried.
   */
  ringSpeed?: number
  /** Amplitude of that ring. Low keeps the interaction subtle. */
  ringAmp?: number
  /**
   * How far the pointer retunes the plate's modal numbers. The single
   * biggest driver of how "grabby" the interaction feels — 1.7 reshapes the
   * whole field, 0.3 is a lean toward the cursor.
   */
  ptWarp?: number
  /** Internal render scale — smaller means coarser grain and less work. */
  quality?: number
  /** Internal buffer width cap. */
  maxW?: number
}

export interface FieldInstance {
  canvas: HTMLCanvasElement
  setColors: (c1: string, c2?: string | null) => void
  pause: () => void
  resume: () => void
  destroy: () => void
}

interface Rgb {
  r: number
  g: number
  b: number
}

// 8x8 ordered Bayer matrix → normalized thresholds. Identical to the
// matrix in Linea/src/renderer/src/cymatics.ts; the grain must match.
const BAYER8 = [
  0, 48, 12, 60, 3, 51, 15, 63, 32, 16, 44, 28, 35, 19, 47, 31, 8, 56, 4, 52, 11, 59, 7, 55, 40, 24,
  36, 20, 43, 27, 39, 23, 2, 50, 14, 62, 1, 49, 13, 61, 34, 18, 46, 30, 33, 17, 45, 29, 10, 58, 6,
  54, 9, 57, 5, 53, 42, 26, 38, 22, 41, 25, 37, 21
].map((v) => (v + 0.5) / 64)

function hexToRgb(hex?: string): Rgb {
  let h = (hex || '#6d5b9e').trim().replace('#', '')
  if (h.length === 3) {
    h = h
      .split('')
      .map((c) => c + c)
      .join('')
  }
  const n = parseInt(h, 16)
  return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 }
}

function mulberry32(a: number): () => number {
  return () => {
    a |= 0
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

export function prefersReducedMotion(): boolean {
  return (
    typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches
  )
}

export function mountField(el: HTMLElement, opts: FieldOptions = {}): FieldInstance {
  const style = opts.style || 'chladni'
  let color = hexToRgb(opts.color)
  let color2 = opts.color2 ? hexToRgb(opts.color2) : null

  const density = opts.density ?? 5
  const dither = opts.dither ?? 0.5
  const scale = opts.scale ?? 1.5
  const seed = opts.seed ?? 7
  const opacity = opts.opacity ?? 1
  const fade = opts.fade !== false
  const speed = opts.speed ?? 1
  const ringSpeed = opts.ringSpeed ?? 0.55
  const ringAmp = opts.ringAmp ?? 0.16
  const ptWarp = opts.ptWarp ?? 0.3
  const quality = opts.quality ?? 0.42
  const maxW = opts.maxW ?? 560

  const reduced = prefersReducedMotion()
  // With reduced motion the field is a still image, so pointer excitation
  // would be the only thing moving — drop it too.
  const ptAmt = reduced ? 0 : (opts.ptAmt ?? 1)

  const rand = mulberry32(seed)
  const P = {
    p1: rand() * 6.28,
    p2: rand() * 6.28,
    p3: rand() * 6.28,
    p4: rand() * 6.28,
    p5: rand() * 6.28
  }
  const n0 = opts.n ?? 2 + (density % 5)
  const m0 = opts.m ?? 3 + ((density + 2) % 6)
  const band = 0.06 + dither * 0.9

  if (getComputedStyle(el).position === 'static') el.style.position = 'relative'

  const display = document.createElement('canvas')
  display.setAttribute('aria-hidden', 'true')
  display.style.cssText =
    'position:absolute;inset:0;width:100%;height:100%;display:block;pointer-events:none;'
  display.style.opacity = String(opacity)
  el.appendChild(display)

  const dctx = display.getContext('2d')!
  dctx.imageSmoothingEnabled = false

  const off = document.createElement('canvas')
  const octx = off.getContext('2d', { willReadFrequently: true })!
  let imgData: ImageData | null = null
  let buf: Uint8ClampedArray | null = null
  let rW = 1
  let rH = 1
  let dispW = 1
  let dispH = 1
  let aspect = 1

  // Pointer: a raw target plus an eased follower, so the field moves like
  // water rather than snapping to the cursor.
  let ptTargetX = 0.5
  let ptTargetY = 0.5
  let ptActive = 0
  let pX = 0.5
  let pY = 0.5
  let pAmt = 0

  function onMove(e: PointerEvent): void {
    const r = el.getBoundingClientRect()
    ptTargetX = Math.min(1, Math.max(0, (e.clientX - r.left) / r.width))
    ptTargetY = Math.min(1, Math.max(0, (e.clientY - r.top) / r.height))
    ptActive = 1
  }
  function onLeave(): void {
    ptActive = 0
  }

  if (ptAmt > 0) {
    el.addEventListener('pointermove', onMove)
    el.addEventListener('pointerleave', onLeave)
  }

  function resize(): void {
    dispW = Math.max(1, Math.round(el.clientWidth))
    dispH = Math.max(1, Math.round(el.clientHeight))
    display.width = dispW
    display.height = dispH
    dctx.imageSmoothingEnabled = false

    const q = Math.min(quality, maxW / dispW)
    rW = Math.max(2, Math.round(dispW * q))
    rH = Math.max(2, Math.round(dispH * q))
    off.width = rW
    off.height = rH
    imgData = octx.createImageData(rW, rH)
    buf = imgData.data
    aspect = rW > rH ? rW / rH : 1
    if (!running) drawOnce()
  }

  const ro = new ResizeObserver(() => resize())
  ro.observe(el)

  const start = performance.now()
  let raf: number | null = null
  let running = false
  // Two independent reasons to be parked: off-screen, or tab hidden. The
  // loop only runs when neither applies and nobody called pause().
  let visible = true
  let pageVisible = typeof document === 'undefined' || !document.hidden
  let paused = false

  function render(elapsed: number): void {
    if (!buf || !imgData) return

    // Two clocks. `t` drives the plate — turn it up and the field feels
    // like something is playing. `tp` drives the ring under the cursor and
    // stays slow, so the interaction reads as a swell rather than a strobe.
    const t = elapsed * speed
    const tp = elapsed * ringSpeed

    // Ease pointer position and influence toward their targets. The
    // influence ramp is deliberately the slowest thing here: the field
    // should notice you gradually, not snap to attention.
    pX += (ptTargetX - pX) * 0.06
    pY += (ptTargetY - pY) * 0.06
    pAmt += (ptActive - pAmt) * 0.022
    const amt = pAmt * ptAmt

    const scaleY = rH > rW ? rH / rW : 1
    const PX = (pX * 2 - 1) * scale * aspect
    const PY = (pY * 2 - 1) * scale * scaleY

    // The modal numbers breathe on their own, and the pointer nudges them.
    // This is the loudest pointer effect by far — it retunes the whole
    // plate, so the entire pattern reorganises as the cursor crosses. Keep
    // `ptWarp` small: past ~0.4 it stops reading as a response and starts
    // reading as the field chasing the mouse.
    const n = n0 + 0.55 * Math.sin(t * 0.16) + (pX - 0.5) * ptWarp * amt
    const m = m0 + 0.55 * Math.sin(t * 0.13 + 1.7) + (pY - 0.5) * ptWarp * amt
    const PI = Math.PI

    const cx = rW / 2
    const cy = rH / 2
    const maxR = Math.sqrt(cx * cx + cy * cy)
    let i = 0

    for (let py = 0; py < rH; py++) {
      const ny = ((py / rH) * 2 - 1) * scale * scaleY
      for (let px = 0; px < rW; px++) {
        const nx = ((px / rW) * 2 - 1) * scale * aspect
        let X = nx
        let Y = ny
        let val: number

        if (style === 'flow') {
          // Advect: part the current around the pointer.
          const dax = X - PX
          const day = Y - PY
          const dd = Math.sqrt(dax * dax + day * day) + 0.0001
          const push = (amt * ptWarp * 1.2) / (1 + dd * 2.6)
          X += (dax / dd) * push
          Y += (day / dd) * push
          const wx = X + Math.sin(Y * 2.3 + t * 0.35 + P.p1) * 0.35
          const wy = Y + Math.cos(X * 2.1 + t * 0.28 + P.p2) * 0.35
          const v =
            Math.sin(wx * 3.1 + t * 0.5 + P.p3) * 0.6 +
            Math.sin((wx + wy) * 2.2 - t * 0.4 + P.p4) * 0.4 +
            Math.cos(wy * 4.0 - t * 0.62 + P.p5) * 0.3
          val = (v + 1) * 0.5
        } else if (style === 'ripple') {
          // Interference of a few travelling ring sources plus the pointer.
          const s1 = Math.sin(
            Math.sqrt((X - 1.1) * (X - 1.1) + (Y - 0.7) * (Y - 0.7)) * 5.5 - t * 1.6 + P.p1
          )
          const s2 = Math.sin(
            Math.sqrt((X + 1.0) * (X + 1.0) + (Y + 0.9) * (Y + 0.9)) * 4.8 - t * 1.3 + P.p2
          )
          const s3 = Math.sin(
            Math.sqrt((X + 0.8) * (X + 0.8) + (Y - 1.0) * (Y - 1.0)) * 6.2 - t * 1.9 + P.p3
          )
          const rpd = Math.sqrt((X - PX) * (X - PX) + (Y - PY) * (Y - PY))
          const sp = Math.sin(rpd * 6 - tp * 2.4) * amt * ringAmp
          val = ((s1 + s2 + s3 + sp) / 3 + 1) * 0.5
        } else if (style === 'lattice') {
          // Standing-wave grid; the pointer warps the local cell size.
          const wp = (amt * ptWarp * 0.7) / (1 + ((X - PX) * (X - PX) + (Y - PY) * (Y - PY)) * 1.8)
          const f = 3.4 + Math.sin(t * 0.12) * 0.4 + wp * 3
          const g1 = Math.cos(X * PI * f + P.p1) * Math.cos(Y * PI * f + P.p2)
          const g2 = Math.cos((X + Y) * PI * f * 0.72 - t * 0.3) * 0.6
          val = Math.abs(g1) * 0.8 + (g2 + 1) * 0.5 * 0.2
          if (val > 1) val = 1
        } else if (style === 'radial') {
          // Circular Chladni plate: k radial rings against p angular petals.
          const RR = Math.sqrt(X * X + Y * Y)
          const TH = Math.atan2(Y, X)
          const kr = n0 + 0.4 * Math.sin(t * 0.15)
          const pth = m0 + (pX - 0.5) * ptWarp * amt
          const ra = Math.cos(kr * RR * 1.5 - t * 0.25) * Math.cos(pth * TH)
          const rb = Math.cos(kr * RR * 1.5 * 0.82 + P.p2) * Math.cos((pth + 1) * TH + t * 0.12)
          val = 1 - Math.min(1, Math.abs(ra - rb) * 2.2)
          const rxr = X - PX
          const ryr = Y - PY
          const rdr = Math.sqrt(rxr * rxr + ryr * ryr)
          val += (Math.cos(rdr * 8 - tp * 2.4) / (1 + rdr * rdr * 5.5)) * amt * ringAmp
          if (val < 0) val = 0
          else if (val > 1) val = 1
        } else {
          // chladni — the default plate
          const hx = X * 0.5
          const hy = Y * 0.5
          const a = Math.cos(n * PI * hx) * Math.cos(m * PI * hy)
          const b = Math.cos(m * PI * hx) * Math.cos(n * PI * hy)
          val = 1 - Math.min(1, Math.abs(a - b) * 2.2)
          // Pointer excitation: a slow ring swelling out of the cursor.
          const rx = X - PX
          const ry = Y - PY
          const rd = Math.sqrt(rx * rx + ry * ry)
          val += (Math.cos(rd * 8 - tp * 2.4) / (1 + rd * rd * 5.5)) * amt * ringAmp
          if (val < 0) val = 0
          else if (val > 1) val = 1
        }

        if (fade) {
          const dxr = px - cx
          const dyr = py - cy
          const rr = Math.sqrt(dxr * dxr + dyr * dyr) / maxR
          const vg = 1 - Math.pow(rr, 1.7)
          val *= vg > 0 ? vg : 0
        }

        const th = BAYER8[(py & 7) * 8 + (px & 7)]
        const on = val - (th - 0.5) * band - 0.5 > 0 ? 255 : 0

        if (color2 && on) {
          // Duotone: sweep between the two colors across a diagonal, warped
          // by the field value so peaks and troughs read as different hues.
          let mt = (px / rW) * 0.44 + (1 - py / rH) * 0.36 + val * 0.2
          if (mt < 0) mt = 0
          else if (mt > 1) mt = 1
          buf[i] = color.r + (color2.r - color.r) * mt
          buf[i + 1] = color.g + (color2.g - color.g) * mt
          buf[i + 2] = color.b + (color2.b - color.b) * mt
        } else {
          buf[i] = color.r
          buf[i + 1] = color.g
          buf[i + 2] = color.b
        }
        buf[i + 3] = on
        i += 4
      }
    }

    octx.putImageData(imgData, 0, 0)
    dctx.clearRect(0, 0, dispW, dispH)
    dctx.drawImage(off, 0, 0, rW, rH, 0, 0, dispW, dispH)
  }

  function drawOnce(): void {
    render(reduced ? 0 : (performance.now() - start) / 1000)
  }

  function frame(now: number): void {
    if (!running) return
    render((now - start) / 1000)
    raf = requestAnimationFrame(frame)
  }

  function shouldRun(): boolean {
    return !reduced && !paused && visible && pageVisible
  }

  function sync(): void {
    if (shouldRun()) {
      if (!running) {
        running = true
        raf = requestAnimationFrame(frame)
      }
    } else if (running) {
      running = false
      if (raf !== null) cancelAnimationFrame(raf)
      raf = null
    }
  }

  // Park the loop whenever the field scrolls out of view. Several of these
  // live on one page; only the ones you can actually see should cost anything.
  const io = new IntersectionObserver(
    (entries) => {
      visible = entries.some((e) => e.isIntersecting)
      sync()
    },
    { rootMargin: '120px' }
  )
  io.observe(el)

  function onVisibility(): void {
    pageVisible = !document.hidden
    sync()
  }
  document.addEventListener('visibilitychange', onVisibility)

  resize()
  drawOnce()
  sync()

  return {
    canvas: display,
    setColors(c1: string, c2?: string | null) {
      color = hexToRgb(c1)
      color2 = c2 ? hexToRgb(c2) : null
      // Repaint immediately so a palette change lands even while parked.
      if (!running) drawOnce()
    },
    pause() {
      paused = true
      sync()
    },
    resume() {
      paused = false
      sync()
    },
    destroy() {
      paused = true
      running = false
      if (raf !== null) cancelAnimationFrame(raf)
      ro.disconnect()
      io.disconnect()
      document.removeEventListener('visibilitychange', onVisibility)
      if (ptAmt > 0) {
        el.removeEventListener('pointermove', onMove)
        el.removeEventListener('pointerleave', onLeave)
      }
      display.remove()
    }
  }
}
