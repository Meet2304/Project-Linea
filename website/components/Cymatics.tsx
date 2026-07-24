'use client'

import { useEffect, useState } from 'react'
import CymaticField from './field/CymaticField'
import Mono from './ui/Mono'
import Icon from './ui/Icon'
import { FIELD_BASE, PALETTES, PATTERNS, type PaletteId } from '@/lib/palettes'
import { prefersReducedMotion } from './field/cymatics-live'

// The six jewels the app cycles through per track. Closing the loop here.
const CYCLE: PaletteId[] = ['ink', 'iris', 'tide', 'dusk', 'fern', 'teal']

/**
 * The one section that isn't selling anything: what cymatics actually is,
 * over the largest and most reactive plate on the page.
 */
export default function Cymatics() {
  const [i, setI] = useState(0)

  useEffect(() => {
    if (prefersReducedMotion()) return
    const id = setInterval(() => setI((v) => (v + 1) % CYCLE.length), 7000)
    return () => clearInterval(id)
  }, [])

  const pal = PALETTES[CYCLE[i]]
  const pat = PATTERNS.bloom

  return (
    <section
      id="cymatics"
      style={{
        position: 'relative',
        minHeight: '92svh',
        display: 'grid',
        placeItems: 'center',
        overflow: 'hidden',
        background: 'var(--white)',
        padding: 'clamp(80px, 10vw, 140px) 0'
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
        opacity={0.62}
      />
      <div className="field-scrim" />

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
        <Mono color={pal.accent} tracking="0.2em">
          // {pat.label} · {pal.name}
        </Mono>

        <h2
          style={{
            margin: '24px 0 0',
            fontSize: 'clamp(30px, 4.4vw, 54px)',
            letterSpacing: '-0.04em',
            lineHeight: 1.02
          }}
        >
          Sound has a shape.
          <br />
          This is it.
        </h2>

        <p
          style={{
            margin: '24px auto 0',
            fontSize: 'var(--text-md)',
            lineHeight: 'var(--leading-relaxed)',
            color: 'var(--ink-2)',
            maxWidth: 540
          }}
        >
          Scatter sand on a metal plate and play a note through it. The grains flee the parts that
          move and settle along the lines that don&rsquo;t — the nodes. Change the note and you get
          a different figure. Ernst Chladni was drawing these in 1787.
        </p>

        <p
          style={{
            margin: '18px auto 0',
            fontSize: 'var(--text-md)',
            lineHeight: 'var(--leading-relaxed)',
            color: 'var(--steel)',
            maxWidth: 540
          }}
        >
          Every pattern on this page is that math, solved per pixel and pushed through an ordered
          dither so it reads as grain rather than gradient. Nothing here is an image. It is being
          computed right now, and it answers to your cursor.
        </p>

        <div
          style={{
            marginTop: 34,
            display: 'inline-flex',
            alignItems: 'center',
            gap: 10,
            pointerEvents: 'auto'
          }}
        >
          <span
            style={{
              display: 'grid',
              placeItems: 'center',
              width: 24,
              height: 24,
              borderRadius: '50%',
              border: `1px solid ${pal.accent}`,
              color: pal.accent
            }}
          >
            <Icon name="mouse-pointer-2" size={11} />
          </span>
          <Mono color="var(--steel)">move to disturb the field</Mono>
        </div>
      </div>
    </section>
  )
}
