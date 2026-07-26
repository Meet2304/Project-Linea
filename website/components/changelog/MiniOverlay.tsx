'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import Thumb from '@/components/demo/Thumb'
import { usePlaybackClock } from '@/components/demo/usePlaybackClock'
import { formatLrcStamp, formatTime, type LyricLine } from '@/components/demo/lyrics'
import type { SongVisuals } from '@/components/demo/cymatic-thumb'
import type { Track } from './releases'
import s from './changelog.module.css'

/**
 * Linea, docked at the corner of a letter, playing the song that was on while
 * that release was built. Not a picture of the panel — the same lyric
 * scheduler, follow mode, click-to-seek and evolving tile as the homepage
 * demo, at the app's own proportions.
 *
 * The app's window opens at 600x250 (INITIAL_WIDTH/INITIAL_HEIGHT in
 * Linea/src/main/index.ts), so this is wide and shallow rather than square,
 * and shows three lyric lines like the app's default window.
 *
 * Words come from /api/lyrics at request time — the route asks lrclib, which
 * is what the desktop app does. Nothing is stored here. Until they arrive (or
 * if lrclib has no match) the panel runs the original stand-in lines it was
 * given, and says so.
 */

interface Props {
  track: Track
  song?: SongVisuals
  accentHex: string
  /** Original writing, shown until the real words land. */
  fallback: { lines: LyricLine[]; durationMs: number }
}

export default function MiniOverlay({ track, song, accentHex, fallback }: Props) {
  const [lyrics, setLyrics] = useState(fallback)
  const [real, setReal] = useState(false)
  const [following, setFollowing] = useState(true)
  const [visible, setVisible] = useState(false)

  const scrollRef = useRef<HTMLDivElement>(null)
  const rowRefs = useRef<(HTMLButtonElement | null)[]>([])
  const panelRef = useRef<HTMLDivElement>(null)
  // Our own smooth scroll fires onScroll every frame of its animation, during
  // which the active line is by definition off-centre. Ignore that window.
  const programmatic = useRef(0)

  const { positionMs, playing, activeIndex, play, pause, seek } = usePlaybackClock({
    lines: lyrics.lines,
    durationMs: lyrics.durationMs,
    loop: true
  })

  /* --- the real words -------------------------------------------------- */

  useEffect(() => {
    let cancelled = false
    const q = new URLSearchParams({ track: track.title, artist: track.artist })

    fetch(`/api/lyrics?${q}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((data: { lines?: LyricLine[] | null; durationMs?: number } | null) => {
        if (cancelled || !data?.lines?.length) return
        setLyrics({
          lines: data.lines,
          durationMs: data.durationMs ?? data.lines[data.lines.length - 1].t + 12_000
        })
        setReal(true)
      })
      .catch(() => {
        /* lrclib unreachable — the stand-in lines stay, as 0.1.3 taught us to. */
      })

    return () => {
      cancelled = true
    }
  }, [track.title, track.artist])

  /* --- only run while on screen ---------------------------------------- */

  useEffect(() => {
    const panel = panelRef.current
    if (!panel) return
    const io = new IntersectionObserver(([e]) => setVisible(e.isIntersecting), {
      rootMargin: '80px'
    })
    io.observe(panel)
    return () => io.disconnect()
  }, [])

  useEffect(() => {
    // A panel you cannot see should not be running a song.
    if (visible) play()
    else pause()
  }, [visible, play, pause])

  /* --- follow mode ------------------------------------------------------ */

  const scrollToActive = useCallback(
    (behavior: ScrollBehavior) => {
      const scroll = scrollRef.current
      const row = rowRefs.current[activeIndex]
      if (!scroll || !row) return
      programmatic.current = performance.now()
      scroll.scrollTo({
        top: Math.max(0, row.offsetTop - scroll.clientHeight / 2 + row.clientHeight / 2),
        behavior
      })
    },
    [activeIndex]
  )

  useEffect(() => {
    if (following) scrollToActive('smooth')
  }, [following, scrollToActive])

  const onScroll = useCallback(() => {
    if (performance.now() - programmatic.current < 700) return
    const scroll = scrollRef.current
    const row = rowRefs.current[activeIndex]
    if (!scroll || !row) return
    const viewCenter = scroll.scrollTop + scroll.clientHeight / 2
    const rowCenter = row.offsetTop + row.clientHeight / 2
    setFollowing(Math.abs(rowCenter - viewCenter) < scroll.clientHeight * 0.3)
  }, [activeIndex])

  /* --- transport paint --------------------------------------------------
     Position only updates at lyric boundaries — nothing ticks in between, as
     in the app. The bar covers the gap with one linear CSS transition per
     line, so it reads as continuous without a loop behind it. */

  const next = lyrics.lines[activeIndex + 1]
  const boundary = next ? next.t : lyrics.durationMs
  const span = Math.max(0, boundary - positionMs)
  const target = playing ? boundary : positionMs

  return (
    <div className={s.panelWrap}>
      <p className={`mono ${s.panelTag}`}>Playing while this shipped</p>

      <div className={s.panel} ref={panelRef}>
        <div className={s.panelHead}>
          <Thumb
            trackId={track.key}
            color={accentHex}
            playing={playing}
            size={30}
            seedOverride={song?.seed}
          />
          <div className={s.panelMeta}>
            <p className={s.panelTitle}>{track.title}</p>
            <p className={s.panelArtist}>{track.artist}</p>
          </div>
          <button
            type="button"
            className={s.panelPlay}
            data-playing={playing}
            aria-label={playing ? 'Pause' : 'Play'}
            onClick={() => (playing ? pause() : play())}
          />
        </div>

        <div className={s.lyrics}>
          <div className={s.lyricsScroll} ref={scrollRef} onScroll={onScroll}>
            {/* Half a window top and bottom, so the first and last lines can
                still be centred. */}
            <div style={{ height: '42%' }} aria-hidden="true" />
            <div className={s.lyricsList}>
              {lyrics.lines.map((line, i) => (
                <button
                  key={`${line.t}-${i}`}
                  type="button"
                  ref={(el) => {
                    rowRefs.current[i] = el
                  }}
                  className={s.lyricRow}
                  data-pos={i === activeIndex ? 'active' : i < activeIndex ? 'past' : 'next'}
                  onClick={() => {
                    seek(line.t)
                    setFollowing(true)
                  }}
                >
                  <span className={s.lyricTime}>{formatLrcStamp(line.t)}</span>
                  <span className={s.lyricText}>{line.text}</span>
                </button>
              ))}
            </div>
            <div style={{ height: '42%' }} aria-hidden="true" />
          </div>

          {!following && (
            <button
              type="button"
              className={s.jump}
              aria-label="Jump to the current line"
              onClick={() => {
                setFollowing(true)
                scrollToActive('smooth')
              }}
            >
              Now
            </button>
          )}
        </div>

        <div className={s.bar}>
          <span
            style={{
              width: `${Math.min(100, (target / lyrics.durationMs) * 100)}%`,
              transition: playing && span > 0 ? `width ${span}ms linear` : 'none'
            }}
          />
        </div>

        <div className={s.times}>
          <span className="mono">{formatTime(positionMs)}</span>
          <span className="mono">{formatTime(lyrics.durationMs)}</span>
        </div>
      </div>

      {/* Only while the words are stand-ins. It removes itself the moment
          lrclib answers. */}
      {!real && <p className={`mono ${s.panelFoot}`}>Stand-in words — fetching from lrclib</p>}
    </div>
  )
}
