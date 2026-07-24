import CymaticField from './field/CymaticField'
import DownloadButton from './DownloadButton'
import Mono from './ui/Mono'
import Icon from './ui/Icon'
import { FIELD_BASE, PALETTES, PATTERNS } from '@/lib/palettes'
import type { ReleaseInfo } from '@/lib/release'

/**
 * The Weave plate in Ink — the brand's default standing wave. Copy only;
 * the product itself appears in the next section so this field stays clean.
 */
export default function Hero({ release }: { release: ReleaseInfo }) {
  const pal = PALETTES.ink
  const pat = PATTERNS.weave

  return (
    <section
      id="top"
      style={{
        position: 'relative',
        minHeight: '100svh',
        display: 'grid',
        placeItems: 'center',
        overflow: 'hidden',
        background: 'var(--white)',
        padding: '120px 0 96px'
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
      />
      <div className="field-scrim" />

      {/* The plate dissolves into white at the bottom rather than stopping
          at the section edge, so there is no seam where the hero ends and
          the features section begins. Tall and mostly transparent — the
          fade should be felt, not seen. */}
      <div
        aria-hidden="true"
        style={{
          position: 'absolute',
          left: 0,
          right: 0,
          bottom: 0,
          height: 'min(34vh, 320px)',
          zIndex: 4,
          pointerEvents: 'none',
          background:
            'linear-gradient(to bottom, rgba(255,255,255,0) 0%, rgba(255,255,255,.28) 34%, rgba(255,255,255,.68) 62%, rgba(255,255,255,.93) 84%, #fff 100%)'
        }}
      />

      <div
        style={{
          position: 'relative',
          zIndex: 5,
          textAlign: 'center',
          padding: '0 clamp(24px, 6vw, 80px)',
          maxWidth: 880,
          pointerEvents: 'none'
        }}
      >
        <Mono color={pal.accent} tracking="0.2em">
          // see the shape of sound
        </Mono>

        <h1
          style={{
            margin: '26px 0 0',
            fontSize: 'clamp(46px, 7.4vw, 100px)',
            fontWeight: 700,
            lineHeight: 0.94,
            letterSpacing: '-0.05em',
            color: 'var(--ink)'
          }}
        >
          Know every word.
        </h1>

        <p
          style={{
            margin: '24px auto 0',
            maxWidth: 460,
            fontSize: 'var(--text-md)',
            lineHeight: 'var(--leading-relaxed)',
            color: 'var(--text-body)'
          }}
        >
          Live Spotify lyrics, floating over everything you do.
        </p>

        <div
          style={{
            display: 'flex',
            gap: 16,
            marginTop: 38,
            alignItems: 'flex-start',
            justifyContent: 'center',
            flexWrap: 'wrap',
            pointerEvents: 'auto'
          }}
        >
          <DownloadButton release={release} accent={pal.accent} />
          {/* A bordered, filled pill rather than a bare text link — the
              ghost version vanished into the field behind it. */}
          <a
            className="hero-secondary"
            href="#features"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 8,
              padding: '15px 26px',
              borderRadius: 'var(--radius-round)',
              border: '1px solid var(--ink)',
              background: 'var(--white)',
              color: 'var(--ink)',
              fontSize: 'var(--text-base)',
              fontWeight: 500,
              letterSpacing: '-0.01em',
              textDecoration: 'none',
              boxShadow: 'var(--shadow-sm)',
              transition: 'transform 160ms var(--ease), background 220ms var(--ease)'
            }}
          >
            See it work
            <Icon name="arrow-right" size={17} />
          </a>
        </div>
      </div>

      <style>{`
        .hero-secondary:hover { transform: translateY(-1px); background: var(--mist); }
        .hero-secondary:active { transform: translateY(0); }
      `}</style>
    </section>
  )
}
