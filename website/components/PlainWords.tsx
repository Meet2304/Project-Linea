import Mono from '@/components/ui/Mono'

/**
 * The landing page is mostly a canvas. This is the part a crawler, a
 * screen reader, or a visitor who wants the product in a sentence can
 * actually use — visible, indexed, and written in the same voice as the
 * rest of the site.
 */
export default function PlainWords() {
  return (
    <section
      id="about"
      style={{
        borderBottom: '1px solid var(--line)',
        background: 'var(--surface-page)'
      }}
    >
      <div
        style={{
          maxWidth: 'var(--container-text)',
          margin: '0 auto',
          padding: 'clamp(64px, 8vw, 110px) clamp(20px, 4vw, 56px)'
        }}
      >
        <Mono>// what it is</Mono>
        <h2
          style={{
            margin: '14px 0 0',
            fontSize: 'clamp(28px, 3.6vw, 44px)',
            letterSpacing: '-0.035em'
          }}
        >
          A lyrics overlay. That is the whole product.
        </h2>
        <p
          style={{
            margin: '18px 0 0',
            fontSize: 'var(--text-md)',
            lineHeight: 'var(--leading-relaxed)',
            color: 'var(--text-body)'
          }}
        >
          Linea is a free, open-source desktop app for Windows. Play a song in Spotify or another
          compatible player; Linea reads the local media session, finds synced lyrics, and floats
          the current line above everything else you have open.
        </p>
        <p
          style={{
            margin: '16px 0 0',
            fontSize: 'var(--text-md)',
            lineHeight: 'var(--leading-relaxed)',
            color: 'var(--steel)'
          }}
        >
          No Spotify login. No developer account. No extra runtime. Lyrics come from LRCLIB, with
          NetEase as a fallback, and stay cached on your machine. This is Project Linea, the overlay
          — not the Linea blockchain.{' '}
          <a href="/faq" style={{ color: 'var(--ink)', textUnderlineOffset: 3 }}>
            FAQ
          </a>
        </p>
      </div>
    </section>
  )
}
