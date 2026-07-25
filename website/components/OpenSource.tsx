import CymaticField from './field/CymaticField'
import CloneTerminal from './oss/CloneTerminal'
import Mono from './ui/Mono'
import Icon, { iconTrigger, type IconName } from './ui/Icon'
import { FIELD_BASE, PALETTES, PATTERNS } from '@/lib/palettes'
import { LICENSE_URL, REPO_URL, type ReleaseInfo } from '@/lib/release'

/**
 * The workbench. One claim — it's all here — one link to the repo, and a
 * terminal that types the four commands it takes to run it yourself.
 */
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
        background: 'var(--surface-page)'
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
            'linear-gradient(to bottom, rgb(var(--scrim-rgb) / .94), rgb(var(--scrim-rgb) / .72) 50%, rgb(var(--scrim-rgb) / .94))'
        }}
      />

      <div
        style={{
          position: 'relative',
          zIndex: 2,
          maxWidth: 'var(--container-text)',
          margin: '0 auto',
          padding: 'clamp(72px, 9vw, 120px) clamp(20px, 4vw, 56px)',
          textAlign: 'center'
        }}
      >
        <Mono tracking="0.2em">// open source</Mono>
        <h2
          style={{
            margin: '18px 0 0',
            fontSize: 'clamp(28px, 3.8vw, 46px)',
            letterSpacing: '-0.035em'
          }}
        >
          MIT, end to end
        </h2>
        <p
          style={{
            margin: '16px auto 0',
            maxWidth: 440,
            fontSize: 'var(--text-md)',
            lineHeight: 'var(--leading-relaxed)',
            color: 'var(--steel)'
          }}
        >
          The whole app is on GitHub. Fork it, build it, or just read how it works.
        </p>

        <div
          style={{
            marginTop: 26,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 10,
            flexWrap: 'wrap'
          }}
        >
          <a
            href={REPO_URL}
            target="_blank"
            rel="noreferrer noopener"
            // The whole button drives the corner arrow, not the 14px glyph.
            className={iconTrigger}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 8,
              padding: '11px 22px',
              borderRadius: 'var(--radius-round)',
              background: 'var(--ink)',
              color: 'var(--surface-page)',
              fontSize: 'var(--text-sm)',
              fontWeight: 500,
              textDecoration: 'none'
            }}
          >
            <Icon name="github" size={16} />
            Browse the source
            <Icon name="arrow-up-right" size={14} />
          </a>
          {!!release.stars && <Stat icon="star" label={`${release.stars} stars`} />}
          {!!release.forks && <Stat icon="git-fork" label={`${release.forks} forks`} />}
          <a href={LICENSE_URL} target="_blank" rel="noreferrer noopener" style={{ textDecoration: 'none' }}>
            <Stat icon="scale" label="MIT" />
          </a>
        </div>

        <div style={{ margin: 'clamp(30px, 4vw, 44px) auto 0', maxWidth: 560, textAlign: 'left' }}>
          <CloneTerminal
            lines={[
              `git clone ${REPO_URL}.git`,
              'cd Project-Linea/Linea',
              'bun install',
              'bun run dev'
            ]}
          />
        </div>
      </div>
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
        background: 'var(--surface-page)',
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
