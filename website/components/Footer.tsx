import CymaticField from './field/CymaticField'
import Mono from './ui/Mono'
import { FIELD_BASE, PALETTES, PATTERNS } from '@/lib/palettes'
import { ISSUES_URL, LICENSE_URL, NOTICE_URL, RELEASES_URL, REPO_URL } from '@/lib/release'

const LINKS: { label: string; href: string }[] = [
  { label: 'GitHub', href: REPO_URL },
  { label: 'Releases', href: RELEASES_URL },
  { label: 'Issues', href: ISSUES_URL },
  { label: 'License', href: LICENSE_URL },
  { label: 'Notices', href: NOTICE_URL },
  { label: 'lrclib', href: 'https://lrclib.net' }
]

/**
 * The sign-off: the name itself, edge to edge, with the live field showing
 * through the letters. An SVG mask knocks "linea." out of a page-colored
 * plate laid over the canvas — so the wordmark is not text *over* the
 * waves, it is a window *into* them, and it answers the cursor like every
 * other plate on the page.
 */
export default function Footer() {
  const pal = PALETTES.iris
  const pat = PATTERNS.weave

  return (
    <footer style={{ borderTop: '1px solid var(--line)', background: 'var(--surface-alt)' }}>
      <h2 className="sr-only">Linea</h2>

      <div
        style={{
          maxWidth: 'var(--container-linea)',
          margin: '0 auto',
          padding: 'clamp(36px, 5vw, 56px) clamp(20px, 4vw, 56px) clamp(10px, 2vw, 20px)',
          display: 'flex',
          flexWrap: 'wrap',
          gap: '16px 32px',
          alignItems: 'baseline',
          justifyContent: 'space-between'
        }}
      >
        <Mono tracking="0.14em">// see the shape of sound</Mono>

        <nav aria-label="Footer" style={{ display: 'flex', flexWrap: 'wrap', gap: '10px 26px' }}>
          {LINKS.map((l) => (
            <a
              key={l.label}
              href={l.href}
              target="_blank"
              rel="noreferrer noopener"
              style={{ textDecoration: 'none' }}
            >
              <Mono color="var(--steel)">{l.label}</Mono>
            </a>
          ))}
        </nav>
      </div>

      {/* The living wordmark. A solid tinted plate sits at the bottom so
          the letterforms always read as a word; the canvas adds moving
          grain on top of it; the SVG lays the page color back over both
          with the letters cut out. */}
      <div style={{ position: 'relative', overflow: 'hidden' }} aria-hidden="true">
        <div
          style={{
            position: 'absolute',
            inset: 0,
            background: 'color-mix(in srgb, var(--amethyst) 34%, var(--surface-page))'
          }}
        />
        <CymaticField
          className="absolute inset-0"
          style={pat.style}
          n={7}
          m={5}
          scale={2.6}
          seed={pat.seed}
          color={pal.c1}
          color2={pal.c2}
          {...FIELD_BASE}
          opacity={0.9}
          ptAmt={0.35}
        />
        <svg
          viewBox="0 0 1200 264"
          style={{ position: 'relative', display: 'block', width: '100%', height: 'auto' }}
        >
          <mask id="linea-knockout">
            <rect width="1200" height="264" fill="#ffffff" />
            <text
              x="600"
              y="224"
              textAnchor="middle"
              textLength="1110"
              lengthAdjust="spacingAndGlyphs"
              fontSize="252"
              fontWeight="700"
              style={{ fontFamily: 'var(--font-sans)', letterSpacing: '-0.04em' }}
              fill="#000000"
            >
              linea.
            </text>
          </mask>
          <rect
            width="1200"
            height="264"
            fill="var(--surface-alt)"
            mask="url(#linea-knockout)"
            style={{ transition: 'fill 700ms var(--ease)' }}
          />
        </svg>
      </div>

      <div
        style={{
          borderTop: '1px solid var(--line)',
          padding: '20px clamp(20px, 4vw, 56px)'
        }}
      >
        <div
          style={{
            maxWidth: 'var(--container-linea)',
            margin: '0 auto',
            display: 'flex',
            flexWrap: 'wrap',
            gap: '8px 18px',
            justifyContent: 'space-between'
          }}
        >
          <Mono>MIT licensed · Lyrics by lrclib.net</Mono>
          <Mono>Made by humans, on Earth</Mono>
          <Mono>Not affiliated with Spotify AB</Mono>
        </div>
      </div>
    </footer>
  )
}
