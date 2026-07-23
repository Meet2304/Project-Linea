import CymaticField from './field/CymaticField'
import DownloadButton from './DownloadButton'
import Mono from './ui/Mono'
import { FIELD_BASE, PALETTES, PATTERNS } from '@/lib/palettes'
import type { ReleaseInfo } from '@/lib/release'

export default function DownloadCTA({ release }: { release: ReleaseInfo }) {
  const pal = PALETTES.ink
  const pat = PATTERNS.star

  return (
    <section
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
        opacity={0.42}
      />
      <div className="field-scrim" />

      <div
        style={{
          position: 'relative',
          zIndex: 2,
          maxWidth: 'var(--container-text)',
          margin: '0 auto',
          padding: 'clamp(80px, 10vw, 140px) clamp(20px, 4vw, 56px)',
          textAlign: 'center',
          pointerEvents: 'none'
        }}
      >
        <Mono tracking="0.2em">// hear it. see it. stay in it.</Mono>
        <h2
          style={{
            margin: '22px 0 0',
            fontSize: 'clamp(30px, 4.4vw, 54px)',
            letterSpacing: '-0.04em',
            lineHeight: 1.02
          }}
        >
          Put the words back
          <br />
          where the music is.
        </h2>
        <p
          style={{
            margin: '20px auto 0',
            maxWidth: 460,
            fontSize: 'var(--text-md)',
            lineHeight: 'var(--leading-relaxed)',
            color: 'var(--steel)'
          }}
        >
          Free and open source. Windows and macOS.
        </p>

        <div
          style={{
            marginTop: 34,
            display: 'flex',
            justifyContent: 'center',
            pointerEvents: 'auto'
          }}
        >
          <DownloadButton release={release} />
        </div>

        <p
          style={{
            margin: '28px auto 0',
            maxWidth: 460,
            fontSize: 'var(--text-sm)',
            lineHeight: 'var(--leading-relaxed)',
            color: 'var(--slate)'
          }}
        >
          Needs a Spotify account. Playback control requires Premium; lyrics work on any plan.
        </p>
      </div>
    </section>
  )
}
