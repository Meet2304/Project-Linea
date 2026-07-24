import CymaticField from './field/CymaticField'
import Mono from './ui/Mono'
import Icon, { type IconName } from './ui/Icon'
import { FIELD_BASE, PALETTES, PATTERNS, type Palette, type Pattern } from '@/lib/palettes'

interface Item {
  icon: IconName
  eyebrow: string
  title: string
  body: string
  points: string[]
  palette: Palette
  pattern: Pattern
}

const ITEMS: Item[] = [
  {
    icon: 'shield',
    eyebrow: '// local-first',
    title: 'Nothing leaves your machine',
    body: 'Linea talks to Spotify and lrclib and to nothing else. There is no Linea account, no server in the middle, and no analytics.',
    points: [
      'OAuth with PKCE — no client secret, ever',
      'The refresh token is encrypted at rest with the OS keychain',
      'Sandboxed renderer, context isolation on, every permission request denied',
      'Lyrics cache to your own disk'
    ],
    palette: PALETTES.fern,
    pattern: PATTERNS.lattice
  },
  {
    icon: 'zap',
    eyebrow: '// fast by design',
    title: 'It sits still when nothing is happening',
    body: 'An overlay that runs all day has to earn its place. Linea does the work at the moment it is needed and then goes quiet.',
    points: [
      'One timer armed at the next lyric — no per-frame loop',
      'Zero timers while paused',
      'Polling backs off from 2s to 10s when you are idle',
      'Crash-resilient: the window recovers itself instead of vanishing'
    ],
    palette: PALETTES.teal,
    pattern: PATTERNS.flow
  }
]

export default function UnderTheHood() {
  return (
    <section
      style={{
        borderTop: '1px solid var(--line)',
        borderBottom: '1px solid var(--line)',
        background: 'var(--paper)'
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
                background: 'var(--white)',
                overflow: 'hidden',
                boxShadow: 'var(--shadow-sm)'
              }}
            >
              <div style={{ position: 'relative', height: 120, background: 'var(--white)' }}>
                <CymaticField
                  className="absolute inset-0"
                  style={item.pattern.style}
                  n={item.pattern.n}
                  m={item.pattern.m}
                  scale={item.pattern.scale}
                  seed={item.pattern.seed}
                  color={item.palette.c1}
                  color2={item.palette.c2}
                  {...FIELD_BASE}
                  opacity={0.5}
                />
                <div
                  style={{
                    position: 'absolute',
                    inset: 0,
                    display: 'flex',
                    alignItems: 'flex-end',
                    padding: 16
                  }}
                >
                  <span
                    style={{
                      width: 40,
                      height: 40,
                      borderRadius: 'var(--radius-md)',
                      background: 'var(--white)',
                      boxShadow: 'var(--shadow-sm)',
                      display: 'grid',
                      placeItems: 'center',
                      color: item.palette.accent
                    }}
                  >
                    <Icon name={item.icon} size={20} />
                  </span>
                </div>
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
