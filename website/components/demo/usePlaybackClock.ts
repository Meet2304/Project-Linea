'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { activeLineIndex, type LyricLine } from './lyrics'

interface Options {
  lines: LyricLine[]
  durationMs: number
  onEnded?: () => void
}

interface Clock {
  positionMs: number
  playing: boolean
  activeIndex: number
  play: () => void
  pause: () => void
  toggle: () => void
  seek: (ms: number) => void
}

/**
 * Mirrors the app's LyricScheduler: instead of a per-frame loop, arm exactly
 * one timer for the next lyric boundary. Nothing ticks between lines, and
 * nothing ticks at all while paused.
 *
 * Position is derived from wall-clock time on read, so the progress bar can
 * still be smooth without the scheduler waking up for it — the transport
 * strip animates via CSS transition instead.
 */
export function usePlaybackClock({ lines, durationMs, onEnded }: Options): Clock {
  const [playing, setPlaying] = useState(false)
  const [positionMs, setPositionMs] = useState(0)

  // Wall-clock anchor: `position` at time `at`. While playing, the true
  // position is anchor.position + (now - anchor.at).
  const anchorRef = useRef({ position: 0, at: 0 })
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const onEndedRef = useRef(onEnded)
  onEndedRef.current = onEnded

  const clearTimer = useCallback(() => {
    if (timerRef.current !== null) {
      clearTimeout(timerRef.current)
      timerRef.current = null
    }
  }, [])

  const readPosition = useCallback(() => {
    const a = anchorRef.current
    if (a.at === 0) return a.position
    return a.position + (performance.now() - a.at)
  }, [])

  /** Arm a single timeout for the next boundary (+15ms, as the app does). */
  const schedule = useCallback(() => {
    clearTimer()
    const now = readPosition()

    if (now >= durationMs) {
      setPositionMs(durationMs)
      setPlaying(false)
      anchorRef.current = { position: durationMs, at: 0 }
      onEndedRef.current?.()
      return
    }

    const idx = activeLineIndex(lines, now)
    const next = lines[idx + 1]
    const boundary = next ? next.t : durationMs
    const delay = Math.max(15, boundary - now + 15)

    timerRef.current = setTimeout(() => {
      setPositionMs(readPosition())
      schedule()
    }, delay)
  }, [clearTimer, durationMs, lines, readPosition])

  useEffect(() => {
    if (!playing) {
      clearTimer()
      return
    }
    anchorRef.current = { position: readPosition(), at: performance.now() }
    setPositionMs(anchorRef.current.position)
    schedule()
    return clearTimer
  }, [playing, clearTimer, readPosition, schedule])

  // A new track resets the transport entirely.
  useEffect(() => {
    anchorRef.current = { position: 0, at: playing ? performance.now() : 0 }
    setPositionMs(0)
    if (playing) schedule()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lines])

  const play = useCallback(() => setPlaying(true), [])
  const pause = useCallback(() => {
    anchorRef.current = { position: readPosition(), at: 0 }
    setPositionMs(anchorRef.current.position)
    setPlaying(false)
  }, [readPosition])
  const toggle = useCallback(() => (playing ? pause() : play()), [playing, pause, play])

  const seek = useCallback(
    (ms: number) => {
      const clamped = Math.max(0, Math.min(durationMs, ms))
      anchorRef.current = { position: clamped, at: playing ? performance.now() : 0 }
      setPositionMs(clamped)
      if (playing) schedule()
    },
    [durationMs, playing, schedule]
  )

  return {
    positionMs,
    playing,
    activeIndex: activeLineIndex(lines, positionMs),
    play,
    pause,
    toggle,
    seek
  }
}
