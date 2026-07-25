'use client'

import { useEffect, useState } from 'react'
import CymaticField from './field/CymaticField'
import Mono from './ui/Mono'
import { FIELD_BASE, PALETTES, PATTERNS, type PaletteId } from '@/lib/palettes'
import { prefersReducedMotion } from './field/cymatics-live'

/**
 * The stage. Every other section sits on the page's surface and follows
 * the theme; this one is an instrument — a lit plate in a dark room, the
 * same near-black in both themes, framed like a piece of lab equipment
 * with its readouts in the corners. The plate answers the cursor, and the
 * jewels take turns under the sand.
 */

// The stage is dark, so the ink palette (near-black on black) sits out.
const CYCLE: PaletteId[] = ['iris', 'tide', 'dusk', 'fern', 'teal']

const STAGE = '#0c0d10'
const STAGE_TEXT = '#f2f3f6'
const STAGE_FAINT = 'rgba(242, 243, 246, 0.55)'

export default function Cymatics() {
  const [i, setI] = useState(0)

  useEffect(() => {
    if (prefersReducedMotion()) return
    const id = setInterval(() => setI((v) => (v + 1) % CYCLE.length), 8000)
    return () => clearInterval(id)
  }, [])

  const pal = PALETTES[CYCLE[i]]
  const pat = PATTERNS.bloom

  const corner = (v: 'top' | 'bottom', h: 'left' | 'right'): React.CSSProperties => ({
    position: 'absolute',
    [v]: 'clamp(26px, 4vw, 52px)',
    [h]: 'clamp(26px, 4.5vw, 60px)',
    zIndex: 5,
    pointerEvents: 'none'
  })

  return (
    <section
      id="cymatics"
      style={{
        position: 'relative',
        minHeight: '100svh',
        display: 'grid',
        placeItems: 'center',
        overflow: 'hidden',
        background: STAGE,
        padding: 'clamp(110px, 14svh, 170px) 0'
      }}
    >
      <CymaticField
        className="absolute inset-0"
        style={pat.style}
        n={pat.n}
        m={pat.m}
        scale={pat.scale}
        seed={pat.seed}
        color={pal.c1}
        color2={pal.c2}
        {...FIELD_BASE}
        quality={0.5}
        opacity={0.6}
      />

      {/* A quiet middle so the words sit on velvet, not on sand. Dense
          enough that the type never fights the grain behind it. */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          pointerEvents: 'none',
          background:
            'radial-gradient(closest-side at 50% 50%, rgb(12 13 16 / 0.97) 22%, rgb(12 13 16 / 0.72) 48%, rgb(12 13 16 / 0) 78%)'
        }}
      />

      {/* The instrument's bezel. */}
      <div
        aria-hidden="true"
        style={{
          position: 'absolute',
          inset: 'clamp(14px, 2vw, 26px)',
          border: '1px solid rgba(242, 243, 246, 0.14)',
          borderRadius: 'var(--radius-lg)',
          pointerEvents: 'none',
          zIndex: 4
        }}
      />

      {/* Corner readouts — the measurements, where a lab would print them. */}
      <div style={corner('top', 'left')}>
        <Mono color={STAGE_FAINT} tracking="0.18em">
          // cymatics
        </Mono>
      </div>
      <div style={corner('top', 'right')}>
        <span key={pal.id} className="cym-fade" style={{ display: 'inline-block' }}>
          <Mono color={pal.c1} tracking="0.18em">
            {pal.name} · {pal.hz}
          </Mono>
        </span>
      </div>
      <div style={corner('bottom', 'left')}>
        <Mono color={STAGE_FAINT} tracking="0.18em">
          {pat.label}
        </Mono>
      </div>
      <div style={corner('bottom', 'right')}>
        <span key={i} className="cym-fade" style={{ display: 'inline-block' }}>
          <Mono color={STAGE_FAINT} tracking="0.18em">
            {`0${i + 1} / 0${CYCLE.length}`}
          </Mono>
        </span>
      </div>

      <div
        style={{
          position: 'relative',
          zIndex: 5,
          maxWidth: 'var(--container-text)',
          padding: '0 clamp(24px, 6vw, 56px)',
          textAlign: 'center',
          pointerEvents: 'none'
        }}
      >
        <h2
          style={{
            margin: 0,
            fontSize: 'clamp(40px, 7vw, 92px)',
            letterSpacing: '-0.045em',
            lineHeight: 0.98,
            color: STAGE_TEXT,
            textShadow: '0 2px 24px rgba(12, 13, 16, 0.9)'
          }}
        >
          Sound has a shape.
        </h2>

        <p
          style={{
            margin: '26px auto 0',
            fontSize: 'var(--text-md)',
            lineHeight: 'var(--leading-relaxed)',
            color: 'rgba(242, 243, 246, 0.72)',
            maxWidth: 440,
            textShadow: '0 1px 14px rgba(12, 13, 16, 0.9)'
          }}
        >
          Sand on a vibrating plate settles where the plate stands still. Chladni drew these figures
          in 1787 — this one is being computed right now.
        </p>
      </div>

      <style>{`
        .cym-fade {
          animation: cym-fade-in 900ms var(--ease-out);
        }
        @keyframes cym-fade-in {
          from { opacity: 0; transform: translateY(6px); }
        }
        @media (prefers-reduced-motion: reduce) {
          .cym-fade { animation: none; }
        }
      `}</style>
    </section>
  )
}
