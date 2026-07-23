'use client'

import { useEffect, useRef, useState } from 'react'
import s from './scroller.module.css'
import { ACTS } from './acts'
import OverlayDemo from '../demo/OverlayDemo'
import CymaticField from '../field/CymaticField'
import Mono from '../ui/Mono'
import { FIELD_BASE } from '@/lib/palettes'

/**
 * The demo pins in view while the feature copy scrolls past it. Each block
 * that reaches the middle of the viewport becomes the active act, which
 * drives both the demo's state and the plate behind it.
 *
 * Below 1024px this collapses to a plain stack — the demo once at the top,
 * still fully interactive, then the copy. No sticky, no scroll-jacking.
 */
export default function FeatureScroller() {
  const [active, setActive] = useState(0)
  const blockRefs = useRef<(HTMLDivElement | null)[]>([])

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (!entry.isIntersecting) continue
          const i = blockRefs.current.indexOf(entry.target as HTMLDivElement)
          if (i >= 0) setActive(i)
        }
      },
      // A thin band across the middle of the viewport: exactly one block can
      // satisfy it at a time, so the active act never flickers between two.
      { rootMargin: '-45% 0px -45% 0px', threshold: 0 }
    )

    for (const el of blockRefs.current) if (el) observer.observe(el)
    return () => observer.disconnect()
  }, [])

  const act = ACTS[active]

  return (
    <section id="features" className={s.section}>
      <div className={s.intro}>
        <Mono>// one surface, four colors</Mono>
        <h2 className={s.introTitle}>Every feature is a frequency</h2>
        <p className={s.introBody}>
          Below is the real interface, running in your browser. Scroll to walk through what it
          does — or just reach in and use it.
        </p>
      </div>

      {/* Mobile: the demo once, above the copy. */}
      <div className={s.mobileDemo}>
        <OverlayDemo act={act.id} choreograph={false} />
      </div>

      <div className={s.grid}>
        <div className={s.stickyCol}>
          <div className={s.actLabel} style={{ color: act.palette.accent }}>
            <Mono color={act.palette.accent}>
              {act.n} · {act.pattern.label} · {act.palette.name}
            </Mono>
            <span className={s.actRule} />
            <Mono color={act.palette.accent}>{act.palette.hz}</Mono>
          </div>

          <div className={s.fieldWrap}>
            {/* One engine instance per pattern, crossfaded. Swapping the
                style would remount the canvas and blink; stacking them and
                fading opacity does not. */}
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
                  opacity={0.4}
                  ptAmt={0}
                  paused={i !== active}
                />
              </div>
            ))}
            <div style={{ position: 'relative', zIndex: 2 }}>
              <OverlayDemo act={act.id} />
            </div>
          </div>
        </div>

        <div className={s.copyCol}>
          {ACTS.map((a, i) => (
            <div
              key={a.id}
              ref={(el) => {
                blockRefs.current[i] = el
              }}
              className={s.block}
              data-active={i === active}
            >
              <div className={s.blockNum}>
                <Mono color={a.palette.accent} tracking="0.2em">
                  {a.n}
                </Mono>
                <Mono color={a.palette.accent}>{a.eyebrow}</Mono>
              </div>

              <h3 className={s.blockTitle}>{a.title}</h3>
              <p className={s.blockBody}>{a.body}</p>

              <ul className={s.points}>
                {a.points.map((p) => (
                  <li key={p} className={s.point}>
                    {p}
                  </li>
                ))}
              </ul>

              {a.note && <p className={s.note}>{a.note}</p>}
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
