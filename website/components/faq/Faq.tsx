import Mono from '@/components/ui/Mono'
import { FAQ } from '@/lib/seo/faq'

export default function Faq() {
  return (
    <div
      id="top"
      style={{
        maxWidth: 'var(--container-text)',
        margin: '0 auto',
        padding: 'clamp(108px, 14vw, 160px) clamp(20px, 4vw, 56px) clamp(72px, 10vw, 120px)'
      }}
    >
      <Mono>// faq</Mono>
      <h1
        style={{
          margin: '14px 0 0',
          fontSize: 'clamp(36px, 5.4vw, 64px)',
          fontWeight: 700,
          letterSpacing: '-0.045em',
          lineHeight: 0.98
        }}
      >
        Linea, in plain language.
      </h1>
      <p
        style={{
          margin: '20px 0 0',
          fontSize: 'var(--text-md)',
          lineHeight: 'var(--leading-relaxed)',
          color: 'var(--text-body)',
          maxWidth: 520
        }}
      >
        A desktop lyrics overlay for Windows. What it does, what it does not, and how to get it
        sitting above whatever you are already playing.
      </p>

      <div
        style={{
          marginTop: 'clamp(40px, 6vw, 64px)',
          display: 'flex',
          flexDirection: 'column',
          gap: 'clamp(28px, 3.6vw, 40px)'
        }}
      >
        {FAQ.map((item) => (
          <article
            key={item.q}
            style={{
              borderTop: '1px solid var(--line)',
              paddingTop: 'clamp(22px, 2.4vw, 28px)'
            }}
          >
            <h2
              style={{
                margin: 0,
                fontSize: 'var(--text-lg)',
                letterSpacing: '-0.025em',
                lineHeight: 1.25
              }}
            >
              {item.q}
            </h2>
            <p
              style={{
                margin: '12px 0 0',
                fontSize: 'var(--text-sm)',
                lineHeight: 'var(--leading-relaxed)',
                color: 'var(--steel)'
              }}
            >
              {item.a}
            </p>
          </article>
        ))}
      </div>
    </div>
  )
}
