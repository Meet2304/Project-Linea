'use client'

import { useEffect, useRef, useState } from 'react'
import s from './showcase.module.css'
import { ACTS, type Act } from '../features/acts'
import OverlayDemo from '../demo/OverlayDemo'
import CymaticField from '../field/CymaticField'
import { prefersReducedMotion } from '../field/cymatics-live'
import DownloadButton from '../DownloadButton'
import Mono from '../ui/Mono'
import Icon from '../ui/Icon'
import { useTheme } from '../theme/ThemeProvider'
import { FIELD_BASE, PALETTES, PATTERNS } from '@/lib/palettes'
import type { ReleaseInfo } from '@/lib/release'

/**
 * The hero and the feature walkthrough, as one continuous shot.
 *
 * Layering matters here and is done by z-index, not DOM order: a
 * `position: sticky` element always creates a stacking context, so a card
 * nested inside one can never sit in front of the copy while the plate
 * behind it stays behind. Three siblings instead —
 *
 *   .bg       z 0   the full-bleed plate
 *   .flow     z 1   hero copy, then the four act sentinels
 *   .cardRail z 3   the pinned panel with the act copy beneath it
 *
 * The card is sticky *inside* the flow, so its hero position is simply
 * where it falls in normal flow — no transform to mis-measure, and no way
 * for it to end up clipped by the fold.
 *
 * The act copy never scrolls: it lives in a fixed slot under the pinned
 * card and crossfades in place as invisible sentinel panes (which exist
 * only to give each act its share of scroll) pass the middle of the
 * viewport. The final act therefore rests exactly where every other act
 * does, and the whole rail — demo plus copy — leaves together at the end.
 *
 * Scroll drives one custom property, `--handoff` (0 → 1), written straight
 * to the DOM from a rAF-throttled listener; React state would re-render the
 * live canvas panel on every frame.
 *
 * A phone runs the same sequence — one act at a time under the pinned demo.
 * Only the measurements change (see the narrow-screen block in the
 * stylesheet); nothing here branches on width.
 */
function ActCopy({ act }: { act: Act }) {
  return (
    <>
      <div className={s.actNum}>
        <Mono color={act.palette.accent}>{act.eyebrow}</Mono>
      </div>
      <h2 className={s.actTitle}>{act.title}</h2>
      <p className={s.actBody}>{act.body}</p>
      <ul className={s.points}>
        {act.points.map((p) => (
          <li key={p} className={s.point}>
            {p}
          </li>
        ))}
      </ul>
      {act.note && <p className={s.note}>{act.note}</p>}
    </>
  )
}

export default function Showcase({ release }: { release: ReleaseInfo }) {
  const rootRef = useRef<HTMLElement>(null)
  const heroRef = useRef<HTMLDivElement>(null)
  const actRefs = useRef<(HTMLDivElement | null)[]>([])

  const [active, setActive] = useState(0)
  // Whether the walkthrough itself is on screen. The final sentinel stays
  // "active" forever once you scroll past it, so the demo's choreography
  // has to be told when the show is over.
  const [inRun, setInRun] = useState(false)
  const { setInverted } = useTheme()

  const heroPal = PALETTES.ink
  const heroPat = PATTERNS.weave

  /* --- Scroll handoff --------------------------------------------------- */
  useEffect(() => {
    const root = rootRef.current
    const hero = heroRef.current
    if (!root || !hero) return

    // Reduced motion skips the scroll-linked assembly, but the run bounds
    // still have to be tracked — the theme inversion must release when the
    // section scrolls away, moving or not.
    const reduce = prefersReducedMotion()
    if (reduce) root.style.setProperty('--handoff', '1')

    let frame = 0
    let last = -1
    let lastRail: boolean | null = null
    let lastRun: boolean | null = null

    const measure = () => {
      frame = 0
      // The hero pane's own travel is the transition: 0 while it is fully
      // in view, 1 once it has scrolled clear.
      const rect = hero.getBoundingClientRect()
      const span = Math.max(1, rect.height * 0.8)
      const progress = Math.min(1, Math.max(0, -rect.top / span))
      const rounded = reduce ? 1 : Math.round(progress * 100) / 100
      if (!reduce && rounded !== last) {
        last = rounded
        root.style.setProperty('--handoff', String(rounded))
      }

      // Checked every frame — unlike the handoff, these can change while
      // the handoff sits saturated at 1.
      const bounds = root.getBoundingClientRect()
      const vh = window.innerHeight

      // The dots belong to the walkthrough's run and go when it winds down.
      const withinRun = rounded > 0.6 && bounds.bottom > vh * 0.5
      if (withinRun !== lastRail) {
        lastRail = withinRun
        root.style.setProperty('--rail-opacity', withinRun ? '1' : '0')
      }

      // The demo's choreography — and the theme inversion — hold until the
      // section has all but left the viewport, so the page never flips back
      // while the final act is still in front of the reader.
      const run = rounded > 0.6 && bounds.bottom > vh * 0.12
      if (run !== lastRun) {
        lastRun = run
        setInRun(run)
      }
    }

    const onScroll = () => {
      if (frame) return
      frame = requestAnimationFrame(measure)
    }

    measure()
    window.addEventListener('scroll', onScroll, { passive: true })
    window.addEventListener('resize', onScroll)
    return () => {
      if (frame) cancelAnimationFrame(frame)
      window.removeEventListener('scroll', onScroll)
      window.removeEventListener('resize', onScroll)
    }
  }, [])

  /* --- Which act is on screen -------------------------------------------
     A crossing of the band is the cue to look, not the answer itself. One
     fast flick can cross two or three panes inside a single observer
     callback, and taking the last entry in that batch leaves the copy on
     an act the page has already scrolled past — you land on act 02 and
     read act 04. So on any crossing, measure: whichever pane's middle is
     nearest the middle of the viewport is the act in front of the reader.
     Cheap (four rects, only on a crossing) and it cannot drift. */
  useEffect(() => {
    const resolve = () => {
      const mid = window.innerHeight / 2
      let best = -1
      let bestDist = Infinity
      actRefs.current.forEach((el, i) => {
        if (!el) return
        const r = el.getBoundingClientRect()
        const dist = Math.abs(r.top + r.height / 2 - mid)
        if (dist < bestDist) {
          bestDist = dist
          best = i
        }
      })
      if (best >= 0) setActive(best)
    }

    const observer = new IntersectionObserver(resolve, {
      // A thin band across the middle of the viewport.
      rootMargin: '-45% 0px -45% 0px',
      threshold: 0
    })
    for (const el of actRefs.current) if (el) observer.observe(el)
    return () => observer.disconnect()
  }, [])

  // The light/dark act shows the visitor whichever mode they are *not* in
  // for as long as it is on screen, then hands theirs back — including when
  // they scroll clean past the walkthrough while the act is still active.
  const act = ACTS[active]
  useEffect(() => {
    setInverted(inRun && act.invertsTheme === true)
    return () => setInverted(false)
  }, [act, inRun, setInverted])

  return (
    <section
      id="top"
      ref={rootRef}
      className={s.showcase}
      style={{ '--handoff': 0 } as React.CSSProperties}
    >
      {/* Layer 0 — the plate */}
      <div className={s.bg}>
        <div className={s.heroField}>
          <CymaticField
            className="absolute inset-0"
            style={heroPat.style}
            n={heroPat.n}
            m={heroPat.m}
            scale={heroPat.scale}
            seed={heroPat.seed}
            color={heroPal.c1}
            color2={heroPal.c2}
            {...FIELD_BASE}
          />
        </div>
        <div className={s.heroScrim} />
      </div>

      <div className={s.rail} aria-hidden="true">
        {ACTS.map((a, i) => (
          <span key={a.id} className={s.railDot} data-active={i === active} />
        ))}
      </div>

      {/* Layer 1 — the flow, with the pinned card (layer 3) inside it */}
      <div className={s.flow}>
        <div className={s.heroPane} ref={heroRef}>
          <div className={s.heroInner}>
            <Mono color={heroPal.accent} tracking="0.2em">
              // see the shape of sound
            </Mono>

            <h1 className={s.heroTitle}>Know every word.</h1>

            <p className={s.heroSub}>Live Spotify lyrics, floating over everything you do.</p>

            <div className={s.heroCta}>
              <DownloadButton
                release={release}
                accent={heroPal.accent}
                className={s.heroDownload}
              />
              <a className={s.heroSecondary} href="#features">
                See it work
                <Icon name="arrow-right" size={17} />
              </a>
            </div>
          </div>
        </div>

        <div className={s.cardRail}>
          <div className={s.card}>
            <div className={s.cardBacking} />

            <div className={s.cardField}>
              {/* One engine per pattern, crossfaded. Swapping a live
                  instance's style would remount its canvas and blink. */}
              {ACTS.map((a, i) => (
                <div
                  key={a.id}
                  className={s.fieldLayer}
                  style={{ opacity: i === active ? 1 : 0 }}
                  aria-hidden="true"
                >
                  <CymaticField
                    className="absolute inset-0"
                    style={a.pattern.style}
                    n={a.pattern.n}
                    m={a.pattern.m}
                    scale={a.pattern.scale}
                    seed={a.pattern.seed}
                    color={a.palette.c1}
                    color2={a.palette.c2}
                    {...FIELD_BASE}
                    opacity={0.45}
                    fade={false}
                    ptAmt={0}
                    paused={i !== active}
                  />
                </div>
              ))}
            </div>
            <div className={s.cardVeil} />

            <div className={s.panelHolder}>
              {/* Choreography stops when the walkthrough is over, so the
                  panel can't keep resizing while it rides away. */}
              <OverlayDemo act={act.id} choreograph={inRun} />
            </div>
          </div>

          {/* The focus slot: every act's copy, stacked in one place under
              the demo. The active one is visible; the rest wait above or
              below it by a few pixels, so a change reads as the same block
              settling into place rather than text arriving from somewhere. */}
          <div className={s.copySlot}>
            {ACTS.map((a, i) => (
              <div
                key={a.id}
                className={s.slotCopy}
                data-state={i === active ? 'active' : i < active ? 'past' : 'next'}
                aria-hidden={i !== active}
              >
                <ActCopy act={a} />
              </div>
            ))}
          </div>
        </div>

        <div id="features" className={s.actPanes}>
          {/* Invisible sentinels — each one is the share of scroll that its
              act owns. The copy they drive lives in the slot above. */}
          {ACTS.map((a, i) => (
            <div
              key={a.id}
              ref={(el) => {
                actRefs.current[i] = el
              }}
              className={s.actPane}
              aria-hidden="true"
            />
          ))}

          {/* Lets the final act rest below the demo before the rail rides
              away, and keeps Under the Hood from crowding it. */}
          <div className={s.tail} aria-hidden="true" />
        </div>
      </div>
    </section>
  )
}
