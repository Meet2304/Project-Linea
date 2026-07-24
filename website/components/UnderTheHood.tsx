import DitherGlyph, { type GlyphShape } from './hood/DitherGlyph'
import Mono from './ui/Mono'
import { PALETTES, type Palette } from '@/lib/palettes'

interface Item {
  glyph: GlyphShape
  eyebrow: string
  title: string
  /** One sentence. The glyph and the points carry the rest. */
  body: string
  /** Three at most, a few words each. */
  points: string[]
  palette: Palette
}

const ITEMS: Item[] = [
  {
    glyph: 'shield',
    eyebrow: '// local-first',
    title: 'Nothing leaves your machine',
    body: 'No account, no server in the middle, no analytics — Linea talks to Spotify and lrclib, and nothing else.',
    points: [
      'OAuth with PKCE, no client secret',
      'Tokens sealed in the OS keychain',
      'Lyrics cached on your own disk'
    ],
    palette: PALETTES.fern
  },
  {
    glyph: 'bolt',
    eyebrow: '// fast by design',
    title: 'Still when nothing is happening',
    body: 'One timer, armed for the next lyric — nothing ticks between lines, and nothing at all while paused.',
    points: [
      'No per-frame loops',
      'Polling backs off when you idle',
      'Recovers itself after a crash'
    ],
    palette: PALETTES.teal
  }
]

export default function UnderTheHood() {
  return (
    <section
      style={{
        borderTop: '1px solid var(--line)',
        borderBottom: '1px solid var(--line)',
        background: 'var(--surface-alt)'
      }}
    >
      <div
        style={{
          maxWidth: 'var(--container-linea)',
          margin: '0 auto',
          padding: 'clamp(64px, 8vw, 110px) clamp(20px, 4vw, 56px)'
        }}
      >
        <div style={{ marginBottom: 'clamp(32px, 4vw, 54px)', maxWidth: 560 }}>
          <Mono>// under the hood</Mono>
          <h2
            style={{
              margin: '14px 0 0',
              fontSize: 'clamp(28px, 3.6vw, 44px)',
              letterSpacing: '-0.035em'
            }}
          >
            Built to be left running
          </h2>
        </div>

        <div className="hood-grid">
          {ITEMS.map((item) => (
            <article
              key={item.title}
              style={{
                position: 'relative',
                borderRadius: 'var(--radius-xl)',
                border: '1px solid var(--line)',
                background: 'var(--surface-page)',
                overflow: 'hidden',
                boxShadow: 'var(--shadow-sm)'
              }}
            >
              {/* The symbol is the illustration: the feature's icon, drawn
                  as an animated dither field. */}
              <div style={{ position: 'relative', height: 190 }}>
                <DitherGlyph
                  shape={item.glyph}
                  color={item.palette.accent}
                  ambient={item.palette.c2}
                />
              </div>

              <div style={{ padding: 'clamp(20px, 2.4vw, 28px)' }}>
                <Mono color={item.palette.accent}>{item.eyebrow}</Mono>
                <h3
                  style={{
                    margin: '12px 0 0',
                    fontSize: 'var(--text-lg)',
                    letterSpacing: '-0.025em'
                  }}
                >
                  {item.title}
                </h3>
                <p
                  style={{
                    margin: '12px 0 0',
                    fontSize: 'var(--text-sm)',
                    lineHeight: 'var(--leading-relaxed)',
                    color: 'var(--steel)'
                  }}
                >
                  {item.body}
                </p>
                <ul
                  style={{
                    listStyle: 'none',
                    margin: '20px 0 0',
                    padding: 0,
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 9
                  }}
                >
                  {item.points.map((p) => (
                    <li
                      key={p}
                      style={{
                        display: 'flex',
                        gap: 10,
                        fontSize: 'var(--text-sm)',
                        lineHeight: 1.5,
                        color: 'var(--ink-2)'
                      }}
                    >
                      <span
                        aria-hidden="true"
                        style={{
                          flexShrink: 0,
                          width: 5,
                          height: 5,
                          borderRadius: '50%',
                          marginTop: 8,
                          background: item.palette.accent,
                          opacity: 0.6
                        }}
                      />
                      {p}
                    </li>
                  ))}
                </ul>
              </div>
            </article>
          ))}
        </div>
      </div>

      <style>{`
        .hood-grid {
          display: grid;
          grid-template-columns: repeat(2, 1fr);
          gap: clamp(18px, 2.4vw, 28px);
        }
        @media (max-width: 860px) {
          .hood-grid { grid-template-columns: 1fr; }
        }
      `}</style>
    </section>
  )
}
