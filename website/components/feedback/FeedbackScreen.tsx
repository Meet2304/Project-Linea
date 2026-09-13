'use client'

import CymaticField from '@/components/field/CymaticField'
import Mono from '@/components/ui/Mono'
import { FIELD_BASE, PALETTES, PATTERNS } from '@/lib/palettes'
import FeedbackForm from './FeedbackForm'
import s from './feedback.module.css'

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
            A sentence is enough. Send files it as a GitHub issue so it lands next to the rest of
            Linea&apos;s work.
          </p>
        </header>

        <FeedbackForm />
      </div>
    </section>
  )
}
