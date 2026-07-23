'use client'

import { useEffect, useState } from 'react'
import Wordmark from './ui/Wordmark'
import Mono from './ui/Mono'
import Icon from './ui/Icon'
import { REPO_URL } from '@/lib/release'

const LINKS = [
  { href: '#features', label: 'Features' },
  { href: '#cymatics', label: 'Cymatics' },
  { href: '#source', label: 'Source' }
]

export default function Nav() {
  // The bar is transparent over the hero field and picks up its blurred
  // surface once you leave it — the same "this floats" cue as the overlay.
  const [lifted, setLifted] = useState(false)

  useEffect(() => {
    const onScroll = () => setLifted(window.scrollY > 40)
    onScroll()
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  return (
    <header
      className={lifted ? 'floating-surface' : undefined}
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        zIndex: 50,
        borderBottom: `1px solid ${lifted ? 'var(--line)' : 'transparent'}`,
        transition: 'border-color 220ms var(--ease), background 220ms var(--ease)'
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
          gap: 20
        }}
      >
        <a href="#top" aria-label="Linea — home" style={{ textDecoration: 'none' }}>
          <Wordmark size={24} />
        </a>

        <div style={{ display: 'flex', alignItems: 'center', gap: 'clamp(16px, 2.4vw, 30px)' }}>
          <div className="nav-links" style={{ display: 'flex', gap: 'clamp(16px, 2.4vw, 30px)' }}>
            {LINKS.map((l) => (
              <a key={l.href} href={l.href} style={{ textDecoration: 'none' }}>
                <Mono color="var(--steel)">{l.label}</Mono>
              </a>
            ))}
          </div>

          <a
            href={REPO_URL}
            target="_blank"
            rel="noreferrer noopener"
            aria-label="Linea on GitHub"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 8,
              padding: '8px 16px',
              borderRadius: 'var(--radius-round)',
              border: '1px solid var(--line)',
              color: 'var(--ink)',
              textDecoration: 'none',
              background: 'var(--white)',
              transition: 'border-color 220ms var(--ease)'
            }}
          >
            <Icon name="github" size={15} />
            <Mono color="var(--ink)" tracking="0.12em">
              GitHub
            </Mono>
          </a>
        </div>
      </nav>

      <style>{`
        @media (max-width: 720px) {
          .nav-links { display: none !important; }
        }
      `}</style>
    </header>
  )
}
