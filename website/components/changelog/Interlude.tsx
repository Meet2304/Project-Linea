'use client'

import { useEffect, useRef, useState } from 'react'
import type { Release } from './releases'
import s from './changelog.module.css'

/**
 * The gap between two letters.
 *
 * A run of corrections collapses into one screen: three in a row should read
 * as one short passage, not three events. They get no plate, no colour and no
 * signature — the emphasis system on this page is real estate and voice, and
 * the quiet ones are simply never given a stage.
 *
 * It is a full screen like every other, because a snap target shorter than
 * the viewport leaks the next one underneath it. The quiet comes from the
 * alternate surface, the narrower column and the short rail tick instead.
 */

export default function Interlude({ run }: { run: Release[] }) {
  const [open, setOpen] = useState<string | null>(null)
  const [shown, setShown] = useState(false)
  const ref = useRef<HTMLElement>(null)

  useEffect(() => {
    const node = ref.current
    if (!node) return
    const io = new IntersectionObserver(
      ([e]) => {
        if (e.isIntersecting) {
          setShown(true)
          io.disconnect()
        }
      },
      { rootMargin: '-10% 0px -10%' }
    )
    io.observe(node)
    return () => io.disconnect()
  }, [])

  return (
    <section ref={ref} className={`${s.screen} ${s.interlude}`}>
      <div className={`${s.interludeInner} ${shown ? s.in : ''}`}>
        <div className={s.interludeLead}>
          <p className="mono">In between · {run.length} corrections</p>
          <h2>Three releases in one evening, and not one of them was a feature.</h2>
          <p>
            The build did not open. Then it opened but could not log in. Then it logged in and
            lied about why the lyrics were missing. No letters for these — just the record.
          </p>
        </div>

        <div className={s.fixes}>
          {run.map((r) => {
            const isOpen = open === r.version
            return (
              <div key={r.version} className={s.fix} data-open={isOpen}>
                <button
                  type="button"
                  className={s.fixHead}
                  aria-expanded={isOpen}
                  onClick={() => setOpen(isOpen ? null : r.version)}
                >
                  <span className={s.fixVer}>{r.version}</span>
                  {/* Title only. The aside is good writing but three of them
                      stacked turns a quiet list into a wall — it waits inside. */}
                  <span className={s.fixTitle}>{r.title}</span>
                  <span className={s.fixChev}>›</span>
                </button>

                <div className={s.fixPanel}>
                  <div>
                    {/* Two sentences and a link. A correction earns a line on
                        this page, not a breakdown — the full post-mortem is
                        already written, and it lives one click away. */}
                    <div className={s.fixInner}>
                      {r.note && <p className={s.fixAside}>{r.note}</p>}
                      <p>{r.lede}</p>
                      <a
                        className={s.ghostLink}
                        href={r.url}
                        target="_blank"
                        rel="noreferrer noopener"
                      >
                        Release notes ↗
                      </a>
                    </div>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </section>
  )
}
