'use client'

import { Suspense } from 'react'
import CymaticField from '@/components/field/CymaticField'
import Mono from '@/components/ui/Mono'
import { FIELD_BASE, PALETTES, PATTERNS } from '@/lib/palettes'
import FeedbackForm from './FeedbackForm'
import s from './feedback.module.css'

/**
 * A letter, not a ticket form. The live plate sits behind the type the same
 * way it does on the rest of the site; the form is the quiet thing on top.
 */
export default function FeedbackScreen() {
  const pal = PALETTES.iris
  const pat = PATTERNS.weave

  return (
    <section className={s.screen}>
      <CymaticField
        className="absolute inset-0"
        style={pat.style}
        n={7}
        m={5}
        scale={2.6}
        seed={pat.seed}
        color={pal.c1}
        color2={pal.c2}
        {...FIELD_BASE}
        opacity={0.28}
        ptAmt={0}
      />
      <div className={s.scrim} />

      <div className={s.inner}>
        <header className={s.intro}>
          <Mono tracking="0.2em">// trouble</Mono>
          <h1 className={s.title}>Something&apos;s off.</h1>
          <p className={s.lede}>
            Tell me what broke. The form asks for the few things that actually help — Windows
            version, player, song — so I don&apos;t have to guess.
          </p>
        </header>

        <Suspense fallback={<p className={s.lede}>Loading the form…</p>}>
          <FeedbackForm />
        </Suspense>
      </div>
    </section>
  )
}
