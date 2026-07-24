import CymaticField from './field/CymaticField'
import DownloadButton from './DownloadButton'
import Mono from './ui/Mono'
import { FIELD_BASE, PALETTES, PATTERNS } from '@/lib/palettes'
import type { ReleaseInfo } from '@/lib/release'

/**
 * The landing. After a page of motion, this one is nearly still: the plate
 * runs at a fraction of its usual speed, and the only movement left is a
 * slow ring breathing out of the download button.
 */
export default function DownloadCTA({ release }: { release: ReleaseInfo }) {
  const pal = PALETTES.ink
  const pat = PATTERNS.star

  return (
    <section
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
        speed={2}
        ringSpeed={0.35}
        opacity={0.38}
      />
      <div className="field-scrim" />

      <div
        style={{
          position: 'relative',
          zIndex: 2,
          maxWidth: 'var(--container-text)',
          margin: '0 auto',
          padding: 'clamp(88px, 11vw, 150px) clamp(20px, 4vw, 56px)',
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
            marginTop: 36,
            display: 'flex',
            justifyContent: 'center',
            pointerEvents: 'auto'
          }}
        >
          <span className="cta-halo">
            <DownloadButton release={release} />
          </span>
        </div>

        <p
          style={{
            margin: '30px auto 0',
            maxWidth: 460,
            fontSize: 'var(--text-sm)',
            lineHeight: 'var(--leading-relaxed)',
            color: 'var(--slate)'
          }}
        >
          Needs Spotify — Premium to control playback, lyrics on any plan.
        </p>
      </div>

      <style>{`
        .cta-halo {
          position: relative;
          display: inline-flex;
        }
        .cta-halo::before,
        .cta-halo::after {
          content: '';
          position: absolute;
          inset: 0;
          border-radius: var(--radius-round);
          border: 1px solid var(--ink);
          opacity: 0;
          pointer-events: none;
          animation: cta-breathe 4.2s var(--ease-out) infinite;
        }
        .cta-halo::after {
          animation-delay: 2.1s;
        }
        @keyframes cta-breathe {
          0% { transform: scale(1); opacity: 0.4; }
          70% { transform: scale(1.45); opacity: 0; }
          100% { transform: scale(1.45); opacity: 0; }
        }
        @media (prefers-reduced-motion: reduce) {
          .cta-halo::before,
          .cta-halo::after {
            animation: none;
          }
        }
      `}</style>
    </section>
  )
}
