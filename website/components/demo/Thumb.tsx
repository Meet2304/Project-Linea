'use client'

import { useEffect, useRef } from 'react'
import { drawThumb } from './cymatic-thumb'
import { prefersReducedMotion } from '../field/cymatics-live'

interface Props {
  trackId: string
  /** Resolved hex — the track's jewel. */
  color: string
  playing: boolean
  /** CSS size in px; the buffer is always 64x64, as in the app. */
  size?: number
  className?: string
}

/** The app advances the thumb phase at 1.7 rad/s, capped near 30fps. */
const PHASE_RATE = 1.7
const FRAME_MS = 1000 / 30

/**
 * The little standing-wave tile beside the track title. It evolves while the
 * song plays and holds a still frame when paused — same as the real overlay.
 */
export default function Thumb({ trackId, color, playing, size = 30, className }: Props) {
  const ref = useRef<HTMLCanvasElement>(null)
  const scratch = useRef<{ buf: Uint8ClampedArray; image: ImageData } | null>(null)
  const phase = useRef(0)

  useEffect(() => {
    const canvas = ref.current
    if (!canvas) return

    const reduced = prefersReducedMotion()

    // Paused, or motion-averse: one frame at the current phase, no loop.
    if (!playing || reduced) {
      scratch.current = drawThumb(canvas, trackId, color, phase.current, scratch.current)
      return
    }

    let raf = 0
    let last = performance.now()
    let lastDraw = 0

    const tick = (now: number) => {
      raf = requestAnimationFrame(tick)
      const dt = (now - last) / 1000
      last = now
      phase.current += dt * PHASE_RATE
      if (now - lastDraw < FRAME_MS) return
      lastDraw = now
      scratch.current = drawThumb(canvas, trackId, color, phase.current, scratch.current)
    }

    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [trackId, color, playing])

  return (
    <canvas
      ref={ref}
      width={64}
      height={64}
      aria-hidden="true"
      className={className}
      style={{ width: size, height: size, borderRadius: 8, display: 'block', flexShrink: 0 }}
    />
  )
}
