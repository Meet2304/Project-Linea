'use client'

import { useCallback, useEffect, useId, useLayoutEffect, useMemo, useRef, useState } from 'react'
import s from './overlay.module.css'
import Icon from '../ui/Icon'
import Thumb from './Thumb'
import { TRACKS, formatLrcStamp, formatTime } from './lyrics'
import { jewelForTrack } from './cymatic-thumb'
import { usePlaybackClock } from './usePlaybackClock'

export type DemoAct = 'lyrics' | 'transport' | 'tile' | 'yours'

/** Lyric size presets — text size paired with visible line count, as in the app. */
const SIZES = {
  small: { px: 13, label: 'S' },
  medium: { px: 15, label: 'M' },
  large: { px: 18, label: 'L' }
} as const
type SizeKey = keyof typeof SIZES

interface Props {
  /** Which feature the demo should be demonstrating. */
  act?: DemoAct
  /** Set false to leave the demo entirely under the visitor's control. */
  choreograph?: boolean
  className?: string
}

export default function OverlayDemo({ act = 'lyrics', choreograph = true, className }: Props) {
  const [trackIndex, setTrackIndex] = useState(0)
  const track = TRACKS[trackIndex]

  const [theme, setTheme] = useState<'light' | 'dark'>('light')
  const [size, setSize] = useState<SizeKey>('medium')
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
  const { positionMs, playing, activeIndex, toggle, seek, play } = clock

  /* --- Per-track jewel -------------------------------------------------
     One hash picks the pattern and the accent, so the thumbnail, the active
     lyric, the progress hairline and the seek thumb always agree. */
  const jewelToken = useMemo(() => jewelForTrack(track.id), [track.id])
  const [jewelHex, setJewelHex] = useState('#6d5b9e')

  useLayoutEffect(() => {
    const panel = panelRef.current
    if (!panel) return
    const resolved = getComputedStyle(panel).getPropertyValue(jewelToken).trim()
    if (resolved) setJewelHex(resolved)
  }, [jewelToken, theme])

  /* --- Choreography ----------------------------------------------------
     Each act nudges the demo into the state that demonstrates it. The
     moment a visitor touches anything, we hand over: `taken` stays true
     until the act changes, so the demo never fights the person using it. */
  const [taken, setTaken] = useState(false)
  const takeOver = useCallback(() => setTaken(true), [])

  useEffect(() => {
    setTaken(false)
  }, [act])

  useEffect(() => {
    if (!choreograph || taken) return

    // Every act starts from the same baseline and then diverges.
    setSettingsOpen(act === 'yours')
    setTimestamps(act === 'lyrics')
    setTheme(act === 'yours' ? 'dark' : 'light')
    setPointerInside(act === 'transport')
    if (!playing) play()

    if (act !== 'yours') setSize('medium')

    // Act 03 walks the playlist so you can watch the accent change.
    if (act === 'tile') {
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
      <div className={s.demoBed}>
        <div className={s.demoBedLines} />

        <div
          ref={panelRef}
          className={s.app}
          data-theme={theme}
          data-pointer-inside={pointerInside}
          data-settings={settingsOpen}
          data-timestamps={timestamps}
          style={
            {
              '--lyric-accent': jewelHex,
              '--lyrics-size': `${SIZES[size].px}px`,
              '--song-progress': progress,
              aspectRatio: size === 'large' ? '720 / 290' : size === 'small' ? '720 / 225' : undefined
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
              <Thumb trackId={track.id} color={jewelHex} playing={playing} size={30} />
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
                  <button
                    type="button"
                    role="switch"
                    aria-checked={theme === 'dark'}
                    aria-label="Dark theme"
                    className={s.switch}
                    onClick={stop(() => setTheme((t) => (t === 'dark' ? 'light' : 'dark')))}
                  />
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
      </div>

      <div className={s.demoHint}>
        <span className="mono">
          <span className={s.demoHintNote}>
            <span className={s.demoHintDot}>
              <Icon name="mouse-pointer-2" size={10} />
            </span>
            hover to reveal the chrome · click to play · this is the real UI, running
          </span>
        </span>
        <div className={s.demoActions}>
          <button
            type="button"
            className={s.demoChip}
            data-active={theme === 'dark'}
            aria-pressed={theme === 'dark'}
            onClick={() => {
              takeOver()
              setTheme((t) => (t === 'dark' ? 'light' : 'dark'))
            }}
          >
            {theme === 'dark' ? 'Dark' : 'Light'}
          </button>
          <button
            type="button"
            className={s.demoChip}
            onClick={() => {
              takeOver()
              nextTrack()
            }}
          >
            Next track
          </button>
        </div>
      </div>
    </div>
  )
}
