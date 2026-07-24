'use client'

import { useEffect, useRef } from 'react'
import { prefersReducedMotion } from '../field/cymatics-live'

/**
 * A glyph drawn the way the plates are drawn: as a field of dots passed
 * through an ordered dither. The glyph's cells carry a slow diagonal
 * shimmer; the field around it sparkles quietly at a fraction of the
 * density, so the symbol reads instantly and the texture stays texture.
 *
 * Everything happens on a coarse cell grid at a stepped frame rate — the
 * chunkiness is the aesthetic, and it makes the whole thing cost almost
 * nothing. Paused offscreen; a single static frame under reduced motion.
 */

/** 8×8 Bayer matrix, values 0–63. */
const BAYER8 = [
  [0, 32, 8, 40, 2, 34, 10, 42],
  [48, 16, 56, 24, 50, 18, 58, 26],
  [12, 44, 4, 36, 14, 46, 6, 38],
  [60, 28, 52, 20, 62, 30, 54, 22],
  [3, 35, 11, 43, 1, 33, 9, 41],
  [51, 19, 59, 27, 49, 17, 57, 25],
  [15, 47, 7, 39, 13, 45, 5, 37],
  [63, 31, 55, 23, 61, 29, 53, 21]
]

/** Lucide silhouettes in their native 24-box — the same paths Icon uses. */
const SHAPES = {
  shield:
    'M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z',
  bolt: 'M4 14a1 1 0 0 1-.78-1.63l9.9-10.2a.5.5 0 0 1 .86.46l-1.92 6.02A1 1 0 0 0 13 10h7a1 1 0 0 1 .78 1.63l-9.9 10.2a.5.5 0 0 1-.86-.46l1.92-6.02A1 1 0 0 0 11 14z'
} as const

export type GlyphShape = keyof typeof SHAPES

interface Props {
  shape: GlyphShape
  /** The glyph's dots — usually the item's accent. */
  color: string
  /** The quiet field around it. */
  ambient: string
  className?: string
}

const CELL = 7
const FPS = 14

export default function DitherGlyph({ shape, color, ambient, className }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const path = new Path2D(SHAPES[shape])
    const reduce = prefersReducedMotion()
    const t0 = performance.now()

    // Grid state, rebuilt on resize.
    let cols = 0
    let rows = 0
    let mask = new Uint8Array(0)
    let u = new Float32Array(0)
    let v = new Float32Array(0)

    const draw = (t: number) => {
      const w = canvas.clientWidth
      const h = canvas.clientHeight
      ctx.clearRect(0, 0, w, h)
      for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
          const i = r * cols + c
          const threshold = (BAYER8[r & 7][c & 7] + 0.5) / 64
          if (mask[i]) {
            // A diagonal shimmer sweeping through the glyph.
            const wave = 0.62 + 0.38 * Math.sin(t * 2.1 - (u[i] + v[i]) * 4.4)
            if (wave > threshold) {
              ctx.globalAlpha = 0.92
              ctx.fillStyle = color
              ctx.fillRect(c * CELL + 1, r * CELL + 1, CELL - 2, CELL - 2)
            }
          } else {
            // Sparse drift around it — texture, never competition.
            const amb = 0.12 + 0.09 * Math.sin(t * 0.8 + u[i] * 6.1 - v[i] * 4.3)
            if (amb > threshold) {
              ctx.globalAlpha = 0.38
              ctx.fillStyle = ambient
              ctx.fillRect(c * CELL + 1, r * CELL + 1, CELL - 2, CELL - 2)
            }
          }
        }
      }
      ctx.globalAlpha = 1
    }

    const rebuild = () => {
      const w = canvas.clientWidth
      const h = canvas.clientHeight
      if (!w || !h) return
      const dpr = Math.min(2, window.devicePixelRatio || 1)
      canvas.width = Math.round(w * dpr)
      canvas.height = Math.round(h * dpr)

      cols = Math.ceil(w / CELL)
      rows = Math.ceil(h / CELL)
      mask = new Uint8Array(cols * rows)
      u = new Float32Array(cols * rows)
      v = new Float32Array(cols * rows)

      const side = Math.min(w, h) * 0.8
      const scale = side / 24
      const ox = (w - side) / 2
      const oy = (h - side) / 2

      // Point-in-path runs in the path's own 24-box, so the transform must
      // be identity while testing — the test point is never transformed.
      ctx.setTransform(1, 0, 0, 1, 0, 0)
      for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
          const i = r * cols + c
          const gx = (c * CELL + CELL / 2 - ox) / scale
          const gy = (r * CELL + CELL / 2 - oy) / scale
          u[i] = gx / 24
          v[i] = gy / 24
          mask[i] =
            gx >= 0 && gx <= 24 && gy >= 0 && gy <= 24 && ctx.isPointInPath(path, gx, gy) ? 1 : 0
        }
      }
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)

      // Resizing clears the canvas — put a frame back immediately.
      draw(reduce ? 8 : (performance.now() - t0) / 1000)
    }

    let raf = 0
    let running = false
    let lastFrame = 0

    const frame = (now: number) => {
      raf = requestAnimationFrame(frame)
      if (now - lastFrame < 1000 / FPS) return
      lastFrame = now
      draw((now - t0) / 1000)
    }

    const start = () => {
      if (running || reduce) return
      running = true
      raf = requestAnimationFrame(frame)
    }
    const stop = () => {
      running = false
      cancelAnimationFrame(raf)
    }

    const io = new IntersectionObserver(([e]) => (e.isIntersecting ? start() : stop()), {
      rootMargin: '80px'
    })
    io.observe(canvas)

    const ro = new ResizeObserver(rebuild)
    ro.observe(canvas)

    return () => {
      stop()
      io.disconnect()
      ro.disconnect()
    }
  }, [shape, color, ambient])

  return (
    <canvas
      ref={canvasRef}
      className={className}
      aria-hidden="true"
      style={{ display: 'block', width: '100%', height: '100%' }}
    />
  )
}
