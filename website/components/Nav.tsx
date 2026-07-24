import Wordmark from './ui/Wordmark'
import Mono from './ui/Mono'
import Icon from './ui/Icon'
import ThemeToggle from './theme/ThemeToggle'
import { REPO_URL } from '@/lib/release'

const LINKS = [
  { href: '#features', label: 'Features' },
  { href: '#cymatics', label: 'Cymatics' },
  { href: '#source', label: 'Source' }
]

/**
 * No surface behind the bar — instead a white gradient that is nearly
 * opaque at the very top and fades to nothing before it ends. It buys the
 * type a readable ground without ever drawing an edge, so there is no
 * "white bar" sitting on the page.
 */
export default function Nav() {
  return (
    <header
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        zIndex: 50,
        // Extra room below the nav for the gradient to dissolve into.
        paddingBottom: 44,
        background:
          'linear-gradient(to bottom, rgb(var(--scrim-rgb) / .97) 0%, rgb(var(--scrim-rgb) / .92) 34%, rgb(var(--scrim-rgb) / .6) 62%, rgb(var(--scrim-rgb) / .22) 82%, rgb(var(--scrim-rgb) / 0) 100%)',
        pointerEvents: 'none'
      }}
    >
      <nav
        style={{
          maxWidth: 'var(--container-wide)',
          margin: '0 auto',
          padding: '18px clamp(20px, 4vw, 56px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 20,
          pointerEvents: 'auto'
        }}
      >
        <a
          href="#top"
          aria-label="Linea — home"
          className="nav-wordmark"
          style={{ textDecoration: 'none' }}
        >
          <Wordmark size={24} />
        </a>

        <div style={{ display: 'flex', alignItems: 'center', gap: 'clamp(16px, 2.4vw, 30px)' }}>
          <div className="nav-links" style={{ display: 'flex', gap: 'clamp(16px, 2.4vw, 30px)' }}>
            {LINKS.map((l) => (
              <a key={l.href} href={l.href} className="nav-link" style={{ textDecoration: 'none' }}>
                {/* Full ink, and heavier than the usual mono label — these
                    sit over a live dither field and need the weight. */}
                <Mono color="var(--ink)" style={{ fontWeight: 700 }}>
                  {l.label}
                </Mono>
              </a>
            ))}
          </div>

          <a
            href={REPO_URL}
            target="_blank"
            rel="noreferrer noopener"
            aria-label="Linea on GitHub"
            className="nav-gh"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 8,
              padding: '9px 17px',
              borderRadius: 'var(--radius-round)',
              border: '1px solid var(--ink)',
              color: 'var(--white)',
              textDecoration: 'none',
              background: 'var(--ink)',
              transition: 'background 220ms var(--ease), border-color 220ms var(--ease)'
            }}
          >
            <Icon name="github" size={15} />
            <Mono color="currentColor" tracking="0.12em">
              GitHub
            </Mono>
          </a>

          <ThemeToggle />
        </div>
      </nav>

      <style>{`
        /* A halo in the page color under the type, so a stray node in the
           field behind can never eat a letterform. Follows the theme. */
        .nav-link span, .nav-wordmark {
          text-shadow:
            0 0 4px rgb(var(--scrim-rgb) / .95),
            0 1px 2px rgb(var(--scrim-rgb) / .9);
        }
        .nav-link span { transition: opacity 180ms var(--ease); }
        .nav-link:hover span { opacity: .62; }
        .nav-gh:hover { background: var(--ink-2) !important; border-color: var(--ink-2) !important; }
        @media (max-width: 720px) {
          .nav-links { display: none !important; }
        }
      `}</style>
    </header>
  )
}
