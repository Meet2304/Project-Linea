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
            fontSize: 'clamp(46px, 7vw, 96px)',
            fontWeight: 700,
            lineHeight: 0.95,
            letterSpacing: '-0.05em',
            color: 'var(--ink)'
          }}
        >
          Your music,
          <br />
          as a quiet layer.
        </h1>

        <p
          style={{
            margin: '28px auto 0',
            maxWidth: 540,
            fontSize: 'var(--text-md)',
            lineHeight: 'var(--leading-relaxed)',
            color: 'var(--text-body)'
          }}
        >
          Linea floats a thin surface above whatever you&rsquo;re doing and scrolls the lyrics of
          your Spotify track in time. No switching tabs. No searching. The words settle into place
          like sand on a singing plate.
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
          <a
            href="#features"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 8,
              padding: '14px 22px',
              borderRadius: 'var(--radius-round)',
              color: 'var(--ink)',
              fontSize: 'var(--text-base)',
              fontWeight: 500,
              textDecoration: 'none'
            }}
          >
            See it work
            <Icon name="arrow-right" size={17} />
          </a>
        </div>
      </div>

      {/* Corner labels — numbers as texture, per the brand's voice guide. */}
      <div
        style={{
          position: 'absolute',
          bottom: 30,
          left: 'clamp(20px, 4vw, 56px)',
          right: 'clamp(20px, 4vw, 56px)',
          zIndex: 6,
          display: 'flex',
          justifyContent: 'space-between',
          pointerEvents: 'none'
        }}
      >
        <Mono>
          {pat.label} · {pal.name.toLowerCase()}
        </Mono>
        <Mono>{pal.hz}</Mono>
      </div>
    </section>
  )
}
