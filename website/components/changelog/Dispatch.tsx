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

/**
 * The corner plate, retuned.
 *
 * A real plate does not change colour or change what it is when you drive it
 * harder — it re-forms into a different mode. So hovering keeps the style and
 * the jewel (those are the section's identity, and assignSongVisuals
 * guarantees no two releases share them) and moves only the figure: new modal
 * numbers, new phases.
 *
 * Both halves matter. chladni and radial are drawn from n and m; ripple,
 * lattice and flow have no modal numbers at all and are told apart purely by
 * their phases, which is what the seed reseeds. Changing one without the
 * other would leave three of the five styles sitting perfectly still.
 *
 * Step 0 must reproduce the assigned figure exactly, or a section would come
 * up wearing something other than its own plate before anyone touched it.
 */
function figureFor(
  song: SongVisuals | undefined,
  step: number
): { n: number; m: number; seed: number } {
  // A songless release keeps the radial fallback documented below.
  const base = song ? song.seed : 5
  if (step === 0) return { n: song?.n ?? 4, m: song?.m ?? 6, seed: song ? song.seed % 100_000 : 5 }

  // Golden-ratio stride: consecutive steps land far apart in the modal
  // numbers rather than walking 2, 3, 4 up the scale.
  const seed = (base + step * 0x9e3779b1) >>> 0
  return { n: 2 + (seed % 5), m: 3 + ((seed + 2) % 6), seed: seed % 100_000 }
}

export default function Dispatch({ release: r, song, accentHex }: Props) {
  const [open, setOpen] = useState(false)
  const [shown, setShown] = useState(false)
  // How many times the plate has been retuned by the pointer.
  const [tuning, setTuning] = useState(0)
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
  const figure = figureFor(song, tuning)

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
        // The figure answers the pointer; the style and the jewel do not.
        // These now reach the running field through setPattern rather than
        // remounting it, so a retune re-forms the plate instead of blinking.
        n={figure.n}
        m={figure.m}
        seed={figure.seed}
        scale={1.5}
        speed={0.9}
        dither={0.5}
        opacity={0.5}
        ptWarp={0.32}
        color={accentHex}
        patternKey={r.version}
      />

      {/* The plate is `pointer-events: none` and has to stay that way — it
          lies under the letter, and catching the pointer there would make the
          text unselectable. This is the one thing on the screen you can
          actually aim at, sized and placed over the plate's visible core.
          Decoration, so it is aria-hidden and takes no tab stop; the hint
          only appears once a cursor is already on it. */}
      <div
        className={s.tuner}
        aria-hidden="true"
        onPointerEnter={() => setTuning((v) => v + 1)}
        onClick={() => setTuning((v) => v + 1)}
      >
        <span className={`mono ${s.tunerHint}`}>retune ↻</span>
      </div>

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
