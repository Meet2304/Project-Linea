import Wordmark from './ui/Wordmark'
import Mono from './ui/Mono'
import { ISSUES_URL, LICENSE_URL, NOTICE_URL, RELEASES_URL, REPO_URL } from '@/lib/release'

const LINKS: { label: string; href: string }[] = [
  { label: 'GitHub', href: REPO_URL },
  { label: 'Releases', href: RELEASES_URL },
  { label: 'Issues', href: ISSUES_URL },
  { label: 'License', href: LICENSE_URL },
  { label: 'Notices', href: NOTICE_URL },
  { label: 'lrclib', href: 'https://lrclib.net' }
]

export default function Footer() {
  return (
    <footer style={{ borderTop: '1px solid var(--line)', background: 'var(--paper)' }}>
      <div
        style={{
          maxWidth: 'var(--container-linea)',
          margin: '0 auto',
          padding: 'clamp(40px, 5vw, 64px) clamp(20px, 4vw, 56px)',
          display: 'flex',
          flexWrap: 'wrap',
          gap: 32,
          alignItems: 'flex-start',
          justifyContent: 'space-between'
        }}
      >
        <div>
          <Wordmark size={24} />
          <p style={{ margin: '14px 0 0', maxWidth: 260 }}>
            <Mono tracking="0.14em">// see the shape of sound</Mono>
          </p>
        </div>

        <nav
          aria-label="Footer"
          style={{ display: 'flex', flexWrap: 'wrap', gap: '10px 26px', maxWidth: 420 }}
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
          <Mono>Not affiliated with Spotify AB</Mono>
        </div>
      </div>
    </footer>
  )
}
