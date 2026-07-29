'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import Dispatch from './Dispatch'
import Interlude from './Interlude'
import { assignSongVisuals } from './song'
import { RELEASES, type Release } from './releases'
import { useTheme } from '@/components/theme/ThemeProvider'
import { REPO_URL, RELEASES_URL } from '@/lib/release'
import s from './changelog.module.css'

/**
 * The changelog, assembled from RELEASES.
 *
 * Runs of corrections gather into one interlude, so adding a feature release
 * is a single object in releases.ts and nothing here changes.
 */

type Block = { kind: 'letter'; release: Release } | { kind: 'interlude'; run: Release[] }

function blocksOf(releases: Release[]): Block[] {
  const out: Block[] = []
  let i = 0
  while (i < releases.length) {
    if (releases[i].kind === 'fix') {
      const run: Release[] = []
      while (i < releases.length && releases[i].kind === 'fix') run.push(releases[i++])
      out.push({ kind: 'interlude', run })
    } else {
      out.push({ kind: 'letter', release: releases[i++] })
    }
  }
  return out
}

/**
 * The opener counts itself.
 *
 * These numbers were written by hand and went stale the moment a release was
 * added — which is exactly what this file's header promises does not happen.
 * Spelled out because the headline is prose, not a stat.
 */
const NUMBER_WORDS = [
  'Zero',
  'One',
  'Two',
  'Three',
  'Four',
  'Five',
  'Six',
  'Seven',
  'Eight',
  'Nine',
  'Ten',
  'Eleven',
  'Twelve'
]

const spell = (n: number): string => NUMBER_WORDS[n] ?? String(n)

/**
 * 'var(--emerald)' -> 'emerald'. A release with no song paints from its own
 * accent, and the canvas needs that as a literal like any other jewel —
 * without this it fell through to the amethyst fallback, so the plate and the
 * type it sits behind disagreed.
 */
function tokenOf(accent: string): string | undefined {
  const m = /^var\(--([\w-]+)\)$/.exec(accent.trim())
  return m?.[1]
}

/** Jewel tokens differ between the ramps, so read the live value back. */
function jewelHex(name: string | undefined, fallback: string): string {
  if (typeof window === 'undefined') return fallback
  if (!name) return fallback
  return (
    getComputedStyle(document.documentElement).getPropertyValue(`--${name}`).trim() || fallback
  )
}

export default function Changelog() {
  const { theme } = useTheme()
  const songs = useMemo(() => assignSongVisuals(RELEASES), [])
  const blocks = useMemo(() => blocksOf(RELEASES), [])

  const rootRef = useRef<HTMLDivElement>(null)
  const [active, setActive] = useState(0)

  /* Mandatory snapping belongs to this page only. globals.css carries the
     rule; the attribute scopes it, and it comes off on unmount so the
     homepage keeps its own proximity snapping. */
  useEffect(() => {
    document.documentElement.dataset.snap = 'changelog'
    return () => {
      delete document.documentElement.dataset.snap
    }
  }, [])

  /* The rail: one tick per screen, long for a letter, short for everything
     else. */
  useEffect(() => {
    const root = rootRef.current
    if (!root) return
    const screens = Array.from(root.querySelectorAll('section'))
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (e.isIntersecting && e.intersectionRatio > 0.5) {
            const idx = screens.indexOf(e.target as HTMLElement)
            if (idx > -1) setActive(idx)
          }
        }
      },
      { threshold: [0.5] }
    )
    screens.forEach((el) => io.observe(el))
    return () => io.disconnect()
  }, [blocks.length])

  // Recomputed on every theme flip: the canvases want a literal color.
  const hexes = useMemo(() => {
    const map = new Map<string, string>()
    for (const r of RELEASES) {
      const song = songs.get(r.version)
      map.set(
        r.version,
        jewelHex(song?.jewel ?? tokenOf(r.accent), theme === 'dark' ? '#a894d8' : '#6d5b9e')
      )
    }
    return map
  }, [songs, theme])

  const letters = blocks.filter((b) => b.kind === 'letter').length
  const total = blocks.length + 2 // opener + closer

  return (
    <div ref={rootRef}>
      <div className={s.rail} aria-hidden="true">
        {Array.from({ length: total }).map((_, i) => {
          const isLetter = i > 0 && i <= blocks.length && blocks[i - 1]?.kind === 'letter'
          return (
            <span
              key={i}
              className={`${s.tick} ${isLetter ? s.tickMajor : s.tickMinor} ${
                i === active ? s.tickOn : ''
              }`}
            />
          )
        })}
      </div>

      <section className={`${s.screen} ${s.opener}`}>
        <div className={s.openerInner}>
          <p className="mono">Linea — dispatches</p>
          <h1>
            {spell(RELEASES.length)} releases.
            <br />
            {spell(letters)} of them
            <br />
            worth a letter.
          </h1>
          <p className={s.openerSub}>
            Notes written the night each one shipped, with whatever was playing at the time.
          </p>
          <span className={`mono ${s.hint}`}>Scroll ↓</span>
        </div>
      </section>

      {blocks.map((b) =>
        b.kind === 'letter' ? (
          <Dispatch
            key={b.release.version}
            release={b.release}
            song={songs.get(b.release.version)}
            accentHex={hexes.get(b.release.version) ?? '#6d5b9e'}
          />
        ) : (
          <Interlude key={`fixes-${b.run[0].version}`} run={b.run} />
        )
      )}

      <section className={`${s.screen} ${s.closer}`}>
        <div className={s.closerInner}>
          <h2>That is everything so far.</h2>
          <p>The next letter is already being written.</p>
          <div className={s.closerLinks}>
            <a className={s.ghostLink} href="/">
              ← Back to Linea
            </a>
            <a
              className={s.ghostLink}
              href={RELEASES_URL}
              target="_blank"
              rel="noreferrer noopener"
            >
              All releases ↗
            </a>
            <a className={s.ghostLink} href={REPO_URL} target="_blank" rel="noreferrer noopener">
              GitHub ↗
            </a>
          </div>
        </div>
      </section>
    </div>
  )
}
