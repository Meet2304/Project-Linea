import CymaticField from './field/CymaticField'
import Mono from './ui/Mono'
import Icon, { type IconName } from './ui/Icon'
import { FIELD_BASE, PALETTES, PATTERNS } from '@/lib/palettes'
import { ISSUES_URL, LICENSE_URL, REPO_URL, type ReleaseInfo } from '@/lib/release'

const WAYS: { icon: IconName; title: string; body: string; href: string; cta: string }[] = [
  {
    icon: 'terminal',
    title: 'Read the source',
    body: 'The whole app — main process, renderer, the cymatics engine, the tests. Nothing is hidden behind a build.',
    href: REPO_URL,
    cta: 'Browse the repo'
  },
  {
    icon: 'git-fork',
    title: 'Build it yourself',
    body: 'Clone it, install, and run. Electron + Vite + TypeScript, with vitest and Playwright already wired up.',
    href: `${REPO_URL}#readme`,
    cta: 'Read the setup'
  },
  {
    icon: 'bug',
    title: 'Open an issue',
    body: 'Missing lyrics for a track, an odd window position, an idea. Every report is read.',
    href: ISSUES_URL,
    cta: 'File an issue'
  }
]

export default function OpenSource({ release }: { release: ReleaseInfo }) {
  const pal = PALETTES.ink
  const pat = PATTERNS.lattice

  return (
    <section
      id="source"
      style={{
        position: 'relative',
        overflow: 'hidden',
        borderTop: '1px solid var(--line)',
        background: 'var(--white)'
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
        opacity={0.28}
        ptAmt={0}
      />
      <div
        style={{
          position: 'absolute',
          inset: 0,
          pointerEvents: 'none',
          background:
            'linear-gradient(to bottom, rgba(255,255,255,.94), rgba(255,255,255,.72) 50%, rgba(255,255,255,.94))'
        }}
      />

      <div
        style={{
          position: 'relative',
          zIndex: 2,
          maxWidth: 'var(--container-linea)',
          margin: '0 auto',
          padding: 'clamp(64px, 8vw, 110px) clamp(20px, 4vw, 56px)'
        }}
      >
        <div
          style={{
            display: 'flex',
            flexWrap: 'wrap',
            alignItems: 'flex-end',
            justifyContent: 'space-between',
            gap: 24,
            marginBottom: 'clamp(30px, 4vw, 48px)'
          }}
        >
          <div style={{ maxWidth: 560 }}>
            <Mono>// open source</Mono>
            <h2
              style={{
                margin: '14px 0 0',
                fontSize: 'clamp(28px, 3.6vw, 44px)',
                letterSpacing: '-0.035em'
              }}
            >
              Free, and yours to take apart
            </h2>
            <p
              style={{
                margin: '16px 0 0',
                fontSize: 'var(--text-md)',
                lineHeight: 'var(--leading-relaxed)',
                color: 'var(--steel)'
              }}
            >
              Linea is MIT licensed. Fork it, ship your own, or just look at how the lyric
              scheduler works.
            </p>
          </div>

          {/* Live repo stats. Absent counts simply don't render — no zeroes,
              no invented numbers. */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
            {!!release.stars && <Stat icon="star" label={`${release.stars} stars`} />}
            {!!release.forks && <Stat icon="git-fork" label={`${release.forks} forks`} />}
            <a href={LICENSE_URL} target="_blank" rel="noreferrer noopener" style={{ textDecoration: 'none' }}>
              <Stat icon="scale" label="MIT" />
            </a>
          </div>
        </div>

        <div className="oss-grid">
          {WAYS.map((w) => (
            <a
              key={w.title}
              href={w.href}
              target="_blank"
              rel="noreferrer noopener"
              style={{
                display: 'flex',
                flexDirection: 'column',
                padding: 'clamp(20px, 2.4vw, 28px)',
                borderRadius: 'var(--radius-xl)',
                border: '1px solid var(--line)',
                background: 'var(--white)',
                textDecoration: 'none',
                boxShadow: 'var(--shadow-sm)',
                transition: 'border-color 220ms var(--ease), box-shadow 220ms var(--ease)'
              }}
            >
              <span style={{ color: 'var(--ink)' }}>
                <Icon name={w.icon} size={20} />
              </span>
              <h3 style={{ margin: '16px 0 0', fontSize: 'var(--text-lg)', letterSpacing: '-0.025em' }}>
                {w.title}
              </h3>
              <p
                style={{
                  margin: '10px 0 20px',
                  fontSize: 'var(--text-sm)',
                  lineHeight: 'var(--leading-relaxed)',
                  color: 'var(--steel)',
                  flex: 1
                }}
              >
                {w.body}
              </p>
              <span
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 6,
                  color: 'var(--ink)',
                  fontSize: 'var(--text-sm)',
                  fontWeight: 500
                }}
              >
                {w.cta}
                <Icon name="arrow-up-right" size={15} />
              </span>
            </a>
          ))}
        </div>

        <pre
          style={{
            margin: 'clamp(24px, 3vw, 36px) 0 0',
            padding: '18px 22px',
            borderRadius: 'var(--radius-lg)',
            background: 'var(--ink)',
            color: '#e7e9ef',
            fontFamily: 'var(--font-mono)',
            fontSize: 'var(--text-xs)',
            lineHeight: 1.9,
            overflowX: 'auto'
          }}
        >
          <code>
            {`git clone ${REPO_URL}.git\ncd Project-Linea/Linea\nbun install\nbun run dev`}
          </code>
        </pre>
      </div>

      <style>{`
        .oss-grid {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: clamp(16px, 2vw, 22px);
        }
        @media (max-width: 900px) { .oss-grid { grid-template-columns: 1fr; } }
      `}</style>
    </section>
  )
}

function Stat({ icon, label }: { icon: IconName; label: string }) {
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 7,
        padding: '7px 14px',
        borderRadius: 'var(--radius-round)',
        border: '1px solid var(--line)',
        background: 'var(--white)',
        color: 'var(--ink)'
      }}
    >
      <Icon name={icon} size={14} />
      <Mono color="var(--ink)" tracking="0.12em">
        {label}
      </Mono>
    </span>
  )
}
