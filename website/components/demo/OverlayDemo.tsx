'use client'

import { useCallback, useEffect, useId, useLayoutEffect, useMemo, useRef, useState } from 'react'
import s from './overlay.module.css'
import Icon from '../ui/Icon'
import Thumb from './Thumb'
import { TRACKS, formatLrcStamp, formatTime, type LyricLine } from './lyrics'
import { usePlaybackClock } from './usePlaybackClock'
import { useTheme } from '../theme/ThemeProvider'
import ThemeToggle from '../theme/ThemeToggle'

export type DemoAct = 'lyrics' | 'transport' | 'tile' | 'yours'

/**
 * Lyric size presets, exactly as the app defines them: each text size is
 * paired with the number of lines the window shows at that size.
 * See Linea/src/renderer/src/renderer.ts.
 */
const SIZES = {
  small: { px: 13, lines: 6, label: 'S' },
  medium: { px: 15, lines: 5, label: 'M' },
  large: { px: 18, lines: 3, label: 'L' }
} as const
type SizeKey = keyof typeof SIZES

/** The demo ships on L — biggest type, three lines, as in the reference. */
const DEFAULT_SIZE: SizeKey = 'large'

interface Props {
  /** Which feature the demo should be demonstrating. */
  act?: DemoAct
  /** Set false to leave the demo entirely under the visitor's control. */
  choreograph?: boolean
  className?: string
}

export default function OverlayDemo({ act = 'lyrics', choreograph = true, className }: Props) {
  const [trackIndex, setTrackIndex] = useState(0)
  const baseTrack = TRACKS[trackIndex]

  /* --- Real lyrics ------------------------------------------------------
     Fetched from lrclib through /api/lyrics on mount — the same source the
     desktop app uses, rather than a copy checked into this repo. Until it
     lands (or if it never does) the track keeps its placeholder lines, so
     the panel is never empty. */
  const [fetched, setFetched] = useState<{ lines: LyricLine[]; durationMs?: number } | null>(null)

  useEffect(() => {
    let cancelled = false
    fetch('/api/lyrics')
      .then((r) => (r.ok ? r.json() : null))
      .then((data: { lines?: LyricLine[] | null; durationMs?: number } | null) => {
        if (cancelled || !data?.lines?.length) return
        setFetched({ lines: data.lines, durationMs: data.durationMs })
      })
      .catch(() => {
        /* keep the fallback */
      })
    return () => {
      cancelled = true
    }
  }, [])

  const track = useMemo(
    () =>
      fetched
        ? {
            ...baseTrack,
            lines: fetched.lines,
            durationMs: fetched.durationMs ?? baseTrack.durationMs
          }
        : baseTrack,
    [baseTrack, fetched]
  )

  // The panel does not own a theme of its own — it wears whatever the page
  // is wearing, so the dark-mode act reads as one continuous change rather
  // than a panel flipping inside a white page.
  const { theme } = useTheme()
  const [size, setSize] = useState<SizeKey>(DEFAULT_SIZE)
  const [timestamps, setTimestamps] = useState(false)
  const [pinned, setPinned] = useState(true)
  const [shuffle, setShuffle] = useState(false)
  const [repeat, setRepeat] = useState(false)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [pointerInside, setPointerInside] = useState(false)

  // Follow mode: the active line stays centered until you scroll away.
  const [following, setFollowing] = useState(true)
  const [jumpDir, setJumpDir] = useState<'up' | 'down'>('down')
  const [edges, setEdges] = useState({ up: false, down: false })

  const scrollRef = useRef<HTMLDivElement>(null)
  const listRef = useRef<HTMLDivElement>(null)
  const rowRefs = useRef<(HTMLButtonElement | null)[]>([])
  const panelRef = useRef<HTMLDivElement>(null)
  const seekId = useId()

  const nextTrack = useCallback(() => setTrackIndex((i) => (i + 1) % TRACKS.length), [])

  const clock = usePlaybackClock({
    lines: track.lines,
    durationMs: track.durationMs,
    onEnded: nextTrack
  })
  const { positionMs, playing, activeIndex, toggle, seek, play, pause } = clock

  /* --- Keep the words moving -------------------------------------------
     Real tracks have instrumental intros and bridges. In a lyrics demo a
     silent stretch reads as "frozen", so when the current line has held
     for a moment and the next cue is still far off, slip ahead to just
     before it. The clock stays honest — this is a seek, and the scrub
     moves with it. Also jumps a long outro so the loop never stalls. */
  useEffect(() => {
    if (!playing) return
    const cur = activeIndex >= 0 ? track.lines[activeIndex] : undefined
    const next = track.lines[activeIndex + 1]
    const from = cur ? cur.t : 0
    const target = next ? next.t : track.durationMs
    if (target - from < 7000) return
    const id = window.setTimeout(() => seek(target - 700), 3200)
    return () => window.clearTimeout(id)
  }, [activeIndex, playing, track, seek])

  /* --- Accent ----------------------------------------------------------
     The app picks a per-track jewel; the demo holds one indigo across every
     track instead. On a page that already carries six palettes, a lyric
     color that changes under you reads as noise rather than as a feature.
     The per-track variation still shows in the thumbnail's *shape*, which
     is what act 03 is about.

     Read from CSS rather than hardcoded so it re-resolves when the panel
     flips to dark, where indigo has to lift to stay legible. */
  const [accentHex, setAccentHex] = useState('#4a4fa0')

  useLayoutEffect(() => {
    const panel = panelRef.current
    if (!panel) return
    const resolved = getComputedStyle(panel).getPropertyValue('--indigo').trim()
    if (resolved) setAccentHex(resolved)
  }, [theme])

  /* --- Choreography ----------------------------------------------------
     Each act nudges the demo into the state that demonstrates it. The
     moment a visitor touches anything, we hand over: `taken` stays true
     until the act changes, so the demo never fights the person using it. */
  const [taken, setTaken] = useState(false)
  const takeOver = useCallback(() => setTaken(true), [])

  useEffect(() => {
    setTaken(false)
  }, [act])

  // When the walkthrough lets go — scrolled past its end, or not started —
  // the panel settles back to its resting look. Without this, the size
  // cycling of the light/dark act keeps resizing the window while it rides
  // off the screen. Never overrides a visitor who has taken the controls.
  useEffect(() => {
    if (choreograph || taken) return
    setSettingsOpen(false)
    setTimestamps(false)
    setPointerInside(false)
    setSize(DEFAULT_SIZE)
  }, [choreograph, taken])

  // The panel should never be sitting there stopped. Start the moment it
  // mounts, whether or not an act is driving it.
  useEffect(() => {
    play()
  }, [play])

  useEffect(() => {
    if (!choreograph || taken) return

    // Every act starts from the same baseline and then diverges.
    setSettingsOpen(act === 'yours')
    setTimestamps(act === 'lyrics')
    setPointerInside(act === 'transport')
    if (!playing) play()

    if (act !== 'yours') setSize(DEFAULT_SIZE)

    // Act 02 works its own transport: a short pause, then play again —
    // the click-anywhere-to-pause the copy promises, demonstrated.
    if (act === 'transport') {
      let resume = 0
      const id = setInterval(() => {
        pause()
        resume = window.setTimeout(() => {
          resume = 0
          play()
        }, 1000)
      }, 5200)
      return () => {
        clearInterval(id)
        // Only un-pause if the choreography itself was mid-pause — never
        // override a pause the visitor chose.
        if (resume) {
          window.clearTimeout(resume)
          play()
        }
      }
    }

    // Act 03 walks the playlist so you can watch each song draw its own
    // shape. With a single demo track there is nothing to walk — the
    // thumbnail still animates on its own.
    if (act === 'tile' && TRACKS.length > 1) {
      const id = setInterval(nextTrack, 5200)
      return () => clearInterval(id)
    }

    // Act 04 steps through the size presets against the live preview.
    if (act === 'yours') {
      const order: SizeKey[] = ['small', 'medium', 'large']
      let i = 0
      const id = setInterval(() => {
        i = (i + 1) % order.length
        setSize(order[i])
      }, 2400)
      return () => clearInterval(id)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [act, choreograph, taken, nextTrack])

  /* --- Follow mode -----------------------------------------------------
     A smooth programmatic scroll fires onScroll for every frame of its
     animation, during which the active line is by definition off-center.
     Without this guard, following would switch itself off and the "Now"
     chip would blink every time a lyric advanced. */
  const selfScrolling = useRef(0)

  const scrollToActive = useCallback(
    (behavior: ScrollBehavior = 'smooth') => {
      const scroll = scrollRef.current
      const row = rowRefs.current[activeIndex]
      if (!scroll || !row) return
      const target = row.offsetTop - scroll.clientHeight / 2 + row.clientHeight / 2
      window.clearTimeout(selfScrolling.current)
      selfScrolling.current = window.setTimeout(() => {
        selfScrolling.current = 0
      }, 700)
      scroll.scrollTo({ top: Math.max(0, target), behavior })
    },
    [activeIndex]
  )

  useEffect(() => () => window.clearTimeout(selfScrolling.current), [])

  useEffect(() => {
    if (following) scrollToActive()
  }, [following, scrollToActive])

  const onScroll = useCallback(() => {
    const scroll = scrollRef.current
    const row = rowRefs.current[activeIndex]
    if (!scroll) return

    setEdges({
      up: scroll.scrollTop > 4,
      down: scroll.scrollTop + scroll.clientHeight < scroll.scrollHeight - 4
    })

    // Our own smooth scroll is in flight — the edge cues above are still
    // worth updating, but follow mode must not react to it.
    if (selfScrolling.current) return

    if (!row) return
    const rowCenter = row.offsetTop + row.clientHeight / 2
    const viewCenter = scroll.scrollTop + scroll.clientHeight / 2
    const delta = rowCenter - viewCenter
    // Re-lock once the active line drifts back near the middle — same 30%
    // of viewport height the app uses.
    if (Math.abs(delta) < scroll.clientHeight * 0.3) {
      setFollowing(true)
    } else {
      setFollowing(false)
      setJumpDir(delta > 0 ? 'down' : 'up')
    }
  }, [activeIndex])

  /* --- Interaction ------------------------------------------------------ */
  const progress = track.durationMs > 0 ? positionMs / track.durationMs : 0

  // Clicking the panel body toggles playback, exactly as the real overlay
  // does — but never when the click landed on an actual control.
  const onPanelClick = useCallback(
    (e: React.MouseEvent) => {
      if ((e.target as HTMLElement).closest('button,input,a')) return
      takeOver()
      toggle()
    },
    [takeOver, toggle]
  )

  const stop = (fn: () => void) => (e: React.MouseEvent) => {
    e.stopPropagation()
    takeOver()
    fn()
  }

  return (
    <div className={`${s.demoStage} ${className ?? ''}`}>
      <div
        ref={panelRef}
        className={s.app}
          data-theme={theme}
          data-pointer-inside={pointerInside}
          data-settings={settingsOpen}
          data-timestamps={timestamps}
          style={
            {
              '--lyric-accent': accentHex,
              '--lyrics-size': `${SIZES[size].px}px`,
              // Line count is part of the preset, not a separate setting —
              // the app resizes the window to suit the type size.
              '--visible-lines': SIZES[size].lines,
              '--song-progress': progress
              // No aspect ratio: the panel's height follows the three-line
              // lyric window, so changing the lyric size resizes it the way
              // the real window resizes.
            } as React.CSSProperties
          }
          onPointerEnter={() => {
            setPointerInside(true)
            takeOver()
          }}
          onPointerLeave={() => setPointerInside(false)}
          onClick={onPanelClick}
        >
          <div className={s.stack}>
            {/* Top bar */}
            <header className={s.topbar}>
              <Thumb trackId={track.id} color={accentHex} playing={playing} size={30} />
              <div className={s.track}>
                <span className={s.trackTitle}>{track.title}</span>
                <span className={s.trackArtist}>{track.artist}</span>
              </div>
              <div className={s.topbarActions}>
                <button
                  type="button"
                  className={`${s.ghostBtn} ${s.ghostBtnSm}`}
                  data-active={pinned}
                  aria-pressed={pinned}
                  aria-label="Pin on top"
                  onClick={stop(() => setPinned((v) => !v))}
                >
                  <Icon name="pin" size={15} />
                </button>
                <button
                  type="button"
                  className={`${s.ghostBtn} ${s.ghostBtnSm}`}
                  data-active={settingsOpen}
                  aria-pressed={settingsOpen}
                  aria-label="Settings"
                  onClick={stop(() => setSettingsOpen((v) => !v))}
                >
                  <Icon name="settings" size={15} />
                </button>
                <button
                  type="button"
                  className={`${s.ghostBtn} ${s.ghostBtnSm} ${s.btnClose}`}
                  aria-label="Close (disabled in this demo)"
                  onClick={stop(() => {})}
                >
                  <Icon name="x" size={15} />
                </button>
              </div>
            </header>

            {settingsOpen ? (
              <div className={s.settingsView}>
                <div className={s.setRow}>
                  <span className={s.setLabel}>Theme</span>
                  {/* The app's own sun/moon control, at its settings-row
                      size. Flips the whole page, same as the nav toggle —
                      here the page stands in for the app. */}
                  <ThemeToggle small />
                </div>
                <div className={s.setRow}>
                  <span className={s.setLabel}>Timestamps</span>
                  <button
                    type="button"
                    role="switch"
                    aria-checked={timestamps}
                    aria-label="Show lyric timestamps"
                    className={s.switch}
                    onClick={stop(() => setTimestamps((v) => !v))}
                  />
                </div>
                <div className={s.setRow}>
                  <span className={s.setLabel}>Lyrics size</span>
                  <div className={s.segmented} role="group" aria-label="Lyrics size">
                    {(Object.keys(SIZES) as SizeKey[]).map((key) => (
                      <button
                        key={key}
                        type="button"
                        className={s.seg}
                        data-active={size === key}
                        aria-pressed={size === key}
                        onClick={stop(() => setSize(key))}
                      >
                        {SIZES[key].label}
                      </button>
                    ))}
                  </div>
                </div>
                <div className={s.previewBox} aria-hidden="true">
                  <span className={s.previewLabel}>Preview</span>
                  <span className={s.previewText}>Sand on a plate, finding the line</span>
                </div>
              </div>
            ) : (
              <div className={s.nowView}>
                <section className={s.lyrics} data-up={edges.up} data-down={edges.down}>
                  <div className={s.lyricsScroll} ref={scrollRef} onScroll={onScroll}>
                    {/* Half-viewport padding top and bottom keeps the active
                        line centerable even at the very start and end. */}
                    <div style={{ height: '42%' }} aria-hidden="true" />
                    <div className={s.lyricsList} ref={listRef}>
                      {track.lines.map((line, i) => (
                        <button
                          key={i}
                          type="button"
                          ref={(el) => {
                            rowRefs.current[i] = el
                          }}
                          className={s.lyricRow}
                          data-pos={i === activeIndex ? 'active' : i < activeIndex ? 'past' : 'next'}
                          onClick={stop(() => {
                            seek(line.t)
                            setFollowing(true)
                          })}
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
                      className={s.jumpBtn}
                      data-dir={jumpDir}
                      aria-label="Jump to the current line"
                      onClick={stop(() => {
                        setFollowing(true)
                        scrollToActive()
                      })}
                    >
                      <span>Now</span>
                      <span className={s.jumpDir}>
                        <Icon name="chevron-down" size={12} />
                      </span>
                    </button>
                  )}
                </section>

                <div className={s.controls}>
                  <div className={s.scrub}>
                    <input
                      id={seekId}
                      type="range"
                      className={s.slider}
                      min={0}
                      max={track.durationMs}
                      step={250}
                      value={positionMs}
                      aria-label="Seek"
                      style={{ '--fill': progress * 100 } as React.CSSProperties}
                      onClick={(e) => e.stopPropagation()}
                      onChange={(e) => {
                        takeOver()
                        seek(Number(e.target.value))
                        setFollowing(true)
                      }}
                    />
                    <div className={s.timecodes}>
                      <span>{formatTime(positionMs)}</span>
                      <span>-{formatTime(track.durationMs - positionMs)}</span>
                    </div>
                  </div>

                  <div className={s.transport}>
                    <button
                      type="button"
                      className={`${s.ghostBtn} ${s.ghostBtnSm}`}
                      data-active={shuffle}
                      aria-pressed={shuffle}
                      aria-label="Shuffle"
                      onClick={stop(() => setShuffle((v) => !v))}
                    >
                      <Icon name="shuffle" size={12} />
                    </button>
                    <button
                      type="button"
                      className={s.ghostBtn}
                      aria-label="Previous track"
                      onClick={stop(() => {
                        setTrackIndex((i) => (i - 1 + TRACKS.length) % TRACKS.length)
                      })}
                    >
                      <Icon name="skip-back" size={14} filled />
                    </button>
                    <button
                      type="button"
                      className={`${s.ghostBtn} ${s.playBtn}`}
                      aria-label={playing ? 'Pause' : 'Play'}
                      onClick={stop(toggle)}
                    >
                      <Icon name={playing ? 'pause' : 'play'} size={16} filled />
                    </button>
                    <button
                      type="button"
                      className={s.ghostBtn}
                      aria-label="Next track"
                      onClick={stop(nextTrack)}
                    >
                      <Icon name="skip-forward" size={14} filled />
                    </button>
                    <button
                      type="button"
                      className={`${s.ghostBtn} ${s.ghostBtnSm}`}
                      data-active={repeat}
                      aria-pressed={repeat}
                      aria-label="Repeat"
                      onClick={stop(() => setRepeat((v) => !v))}
                    >
                      <Icon name="repeat" size={12} />
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>

          <div className={s.edgeProgress}>
            <div className={s.edgeProgressFill} />
          </div>

          <svg className={`${s.corner} ${s.cornerNw}`} viewBox="0 0 24 24" aria-hidden="true">
            <path className={s.cornerArc} d="M 2 22 Q 2 2 22 2" />
          </svg>
          <svg className={`${s.corner} ${s.cornerNe}`} viewBox="0 0 24 24" aria-hidden="true">
            <path className={s.cornerArc} d="M 2 2 Q 22 2 22 22" />
          </svg>
          <svg className={`${s.corner} ${s.cornerSe}`} viewBox="0 0 24 24" aria-hidden="true">
            <path className={s.cornerArc} d="M 22 2 Q 22 22 2 22" />
          </svg>
          <svg className={`${s.corner} ${s.cornerSw}`} viewBox="0 0 24 24" aria-hidden="true">
            <path className={s.cornerArc} d="M 22 22 Q 2 22 2 2" />
          </svg>
      </div>

      {/* No caption and no chips. The panel is self-evidently interactive
          once you touch it, and the row was setting a min-content width
          wide enough to push the panel past the card and clip its edge. */}
    </div>
  )
}
