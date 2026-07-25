'use client'

import { useEffect, useState } from 'react'

/**
 * The first-paint veil: a page-colored cover that holds the screen while
 * fonts, canvases and layout settle behind it. The visual is deliberately
 * tiny — the wordmark rising, over a short row of dither-grain dots
 * pulsing in sequence — and pure CSS, server-rendered in the first HTML
 * payload, so it is on screen and animating before hydration and cannot
 * fail to load.
 *
 * JS only decides when to let go: after `window.load` plus a short
 * minimum act — briefer on repeat visits in the same session, and capped
 * so a stalled asset can never hold the page hostage.
 */

const SEEN_KEY = 'linea-veil-seen'
const DOTS = 6

export default function LoadingVeil() {
  const [phase, setPhase] = useState<'shown' | 'leaving' | 'gone'>('shown')

  useEffect(() => {
    let seen = false
    try {
      seen = sessionStorage.getItem(SEEN_KEY) === '1'
      sessionStorage.setItem(SEEN_KEY, '1')
    } catch {
      /* private mode — treat as first visit */
    }

    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    const minMs = reduce ? 0 : seen ? 300 : 1100
    const t0 = performance.now()

    let released = false
    let timer = 0
    const release = () => {
      if (released) return
      released = true
      const wait = Math.max(0, minMs - (performance.now() - t0))
      timer = window.setTimeout(() => setPhase('leaving'), wait)
    }

    if (document.readyState === 'complete') release()
    else window.addEventListener('load', release, { once: true })
    // A stalled image or font must never hold the page.
    const cap = window.setTimeout(release, 3000)

    return () => {
      window.removeEventListener('load', release)
      window.clearTimeout(cap)
      window.clearTimeout(timer)
    }
  }, [])

  // If the opacity transition never fires (edge cases), leave anyway.
  useEffect(() => {
    if (phase !== 'leaving') return
    const id = window.setTimeout(() => setPhase('gone'), 900)
    return () => window.clearTimeout(id)
  }, [phase])

  if (phase === 'gone') return null

  return (
    <div
      aria-hidden="true"
      onTransitionEnd={() => setPhase('gone')}
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 1000,
        display: 'grid',
        placeItems: 'center',
        background: 'var(--surface-page)',
        opacity: phase === 'leaving' ? 0 : 1,
        pointerEvents: phase === 'leaving' ? 'none' : 'auto',
        transition: 'opacity 560ms var(--ease)'
      }}
    >
      <div style={{ display: 'grid', justifyItems: 'center', gap: 18 }}>
        <span
          className="veil-word"
          style={{
            fontFamily: 'var(--font-sans)',
            fontWeight: 700,
            fontSize: 30,
            letterSpacing: '-0.04em',
            color: 'var(--ink)'
          }}
        >
          linea.
        </span>

        {/* Grain settling, in six dots. */}
        <span style={{ display: 'flex', gap: 7 }}>
          {Array.from({ length: DOTS }, (_, i) => (
            <span
              key={i}
              className="veil-dot"
              style={{ animationDelay: `${i * 140}ms` }}
            />
          ))}
        </span>
      </div>

      <style>{`
        /* Pure CSS, so everything plays before hydration. */
        .veil-word {
          animation: veil-rise 700ms var(--ease-out) 100ms backwards;
        }
        .veil-dot {
          width: 4px;
          height: 4px;
          background: var(--ink);
          opacity: 0.15;
          animation: veil-pulse 1.1s var(--ease) infinite;
        }
        @keyframes veil-rise {
          from { opacity: 0; transform: translateY(8px); }
        }
        @keyframes veil-pulse {
          0%, 100% { opacity: 0.15; }
          35% { opacity: 0.9; }
        }
        @media (prefers-reduced-motion: reduce) {
          .veil-word, .veil-dot { animation: none; }
        }
      `}</style>
    </div>
  )
}
