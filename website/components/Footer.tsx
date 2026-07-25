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
        className="foot-top"
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

        <nav
          aria-label="Footer"
          className="foot-links"
          style={{ display: 'flex', flexWrap: 'wrap', gap: '10px 26px' }}
        >
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
        {/* One field per breakpoint. The halftone cell is a fixed size on
            screen, so on a phone — where a letterform is 70px tall rather
            than 300 — the default grain reads as blocks instead of texture.
            The narrow one renders at a much finer buffer to compensate.
            Only ever one of them is displayed, and the hidden one costs
            nothing: the engine parks itself when its host isn't on screen. */}
        <div className="wm-field wm-field-wide">
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
        </div>
        <div className="wm-field wm-field-narrow">
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
            /* No pointer on a phone, and the ring would never be seen. */
            ptAmt={0}
            quality={0.92}
          />
        </div>
        {/* The knockout plate overscans its own viewBox top and bottom: with
            a fractional height (1200:264 of any odd width) the rect's edge
            would otherwise land mid-device-pixel and blend with the field
            beneath it, leaving a faint dotted hairline along both edges. */}
        <svg
          viewBox="0 0 1200 264"
          style={{ position: 'relative', display: 'block', width: '100%', height: 'auto' }}
        >
          <mask id="linea-knockout">
            <rect y="-4" width="1200" height="272" fill="#ffffff" />
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
            y="-4"
            width="1200"
            height="272"
            fill="var(--surface-alt)"
            mask="url(#linea-knockout)"
            style={{ transition: 'fill 700ms var(--ease)' }}
          />
        </svg>
      </div>

      <div
        style={{
          borderTop: '1px solid var(--line)',
          // The home indicator sits over the last line on a phone otherwise.
          padding: '20px clamp(20px, 4vw, 56px) calc(20px + env(safe-area-inset-bottom, 0px))'
        }}
      >
        <div
          className="foot-legal"
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

      <style>{`
        .wm-field { position: absolute; inset: 0; }
        .wm-field-narrow { display: none; }

        .foot-links a span { transition: opacity 180ms var(--ease); }
        .foot-links a:hover span { opacity: .6; }

        /* Below this width the eyebrow, the six links and the three legal
           lines can no longer share their rows: they wrap into ragged
           two-and-a-half-line blocks. Each one gets a shape of its own
           instead. Same breakpoint Under the Hood drops to one column. */
        @media (max-width: 860px) {
          /* Stacked, with the links given room to breathe rather than
             wrapping raggedly out of a row that was built for one line. */
          .foot-top { gap: 22px !important; padding-bottom: 22px !important; }

          /* A tidy index instead of a ragged wrap — and every label gets a
             row tall enough to be a tap target rather than an 11px word. */
          .foot-links {
            display: grid !important;
            grid-template-columns: repeat(auto-fit, minmax(92px, 1fr));
            gap: 0 16px !important;
            width: 100%;
          }
          .foot-links a { display: block; padding: 11px 0; }

          /* Three separate statements, so they read as three lines with the
             same rhythm — not as a paragraph squeezed by space-between. */
          .foot-legal {
            display: grid !important;
            gap: 9px !important;
          }
        }

        /* Phone-sized only, and about the canvas rather than the layout: a
           0.92-quality buffer is cheap behind a 390px-wide wordmark and
           expensive behind an 860px one. */
        @media (max-width: 720px) {
          .wm-field-wide { display: none; }
          .wm-field-narrow { display: block; }
        }
      `}</style>
    </footer>
  )
}
