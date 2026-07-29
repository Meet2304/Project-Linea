'use client'

import { useEffect, useRef, useState } from 'react'
import CymaticField from '@/components/field/CymaticField'
import MiniOverlay from './MiniOverlay'
import { accentVar } from './song'
import { EMPTY_STANDIN, STANDINS } from './standins'
import type { Release } from './releases'
import type { SongVisuals } from '@/components/demo/cymatic-thumb'
import s from './changelog.module.css'

/**
 * One release, one screen, signed.
 *
 * The plate behind it is the song's — same hash, same jewel — and so is the
 * accent, so the whole screen changes colour when the song does. A release
 * without a song falls back to the accent in the data and drops the panel.
 *
 * The screen is exactly one viewport and must never grow, or the flick model
 * breaks (see changelog.module.css). So the notes disclosure scrolls inside
 * the screen rather than extending it.
 */

interface Props {
  release: Release
  song?: SongVisuals
  /** The song's jewel resolved to a literal hex under the active theme. */
  accentHex: string
}

export default function Dispatch({ release: r, song, accentHex }: Props) {
  const [open, setOpen] = useState(false)
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

  const accent = accentVar(r, song)
  const standin = (r.track && STANDINS[r.track.key]) || EMPTY_STANDIN

  return (
    <section
      ref={ref}
      className={`${s.screen} ${s.dispatch}`}
      data-notes={open}
      style={{ ['--accent-c' as string]: accent, ['--song-c' as string]: accent }}
    >
      {/* The class goes on the field itself — it measures its own host, and a
          wrapper would leave it sized zero. */}
      <CymaticField
        className={s.plate}
        // The whole screen drives it, not just the corner it occupies.
        pointerHostRef={ref}
        // A release with no song used to fall back to chladni, whose only
        // answer to the cursor is a glow added on top of its nodal lines —
        // next to flow's advection and lattice's warping cells it read as a
        // blob following the mouse rather than the plate responding. radial
        // retunes instead: its angular petals are driven by the pointer and
        // by nothing else, so crossing the screen twists the figure itself.
        // It is also the one style no song hashes to, so a songless dispatch
        // can never turn up wearing a tracked release's plate.
        style={song?.style ?? 'radial'}
        n={song?.n ?? 4}
        m={song?.m ?? 6}
        seed={song ? song.seed % 100_000 : 5}
        scale={1.5}
        speed={0.9}
        dither={0.5}
        opacity={0.5}
        ptWarp={0.32}
        color={accentHex}
        patternKey={r.version}
      />

      <div className={s.ghost} aria-hidden="true">
        {r.version}
      </div>

      <div className={`${s.letter} ${shown ? s.in : ''}`}>
        <div className={s.stamp}>
          <span className="mono">{r.kind === 'launch' ? 'first release' : 'new capability'}</span>
          <span className={s.stampRule} />
          <span className="mono">{r.dateLong}</span>
        </div>

        <h2 className={s.headline}>{r.headline ?? r.title}</h2>
        <p className={s.lede}>{r.lede}</p>
        {r.note && <p className={s.note}>{r.note}</p>}

        <p className={s.sign}>
          <span className={s.signMark} /> Meet · {r.tag}
        </p>

        <div className={s.actions}>
          <button
            type="button"
            className={s.notesBtn}
            aria-expanded={open}
            onClick={() => setOpen((v) => !v)}
          >
            {open ? 'Close' : 'What changed'}
          </button>
          <a className={s.ghostLink} href={r.url} target="_blank" rel="noreferrer noopener">
            Release notes ↗
          </a>
        </div>

        <div className={s.notes} data-open={open}>
          <div>
            <div className={s.notesInner}>
              <ul className={s.points}>
                {r.points?.map((p) => (
                  <li key={p.h}>
                    <h3>{p.h}</h3>
                    <p>{p.d}</p>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      </div>

      {r.track && (
        <MiniOverlay track={r.track} song={song} accentHex={accentHex} fallback={standin} />
      )}
    </section>
  )
}
