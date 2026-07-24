'use client'

import { useEffect, useRef, useState } from 'react'
import { prefersReducedMotion } from '../field/cymatics-live'

/**
 * The clone-and-run snippet, typing itself the first time it scrolls into
 * view — the section's one piece of theatre. Types once and stays; under
 * reduced motion the finished text simply appears.
 */
export default function CloneTerminal({ lines }: { lines: string[] }) {
  const full = lines.join('\n')
  const [started, setStarted] = useState(false)
  const [n, setN] = useState(0)
  const preRef = useRef<HTMLPreElement>(null)

  useEffect(() => {
    const el = preRef.current
    if (!el) return
    if (prefersReducedMotion()) {
      setStarted(true)
      setN(full.length)
      return
    }
    const io = new IntersectionObserver(
      ([e]) => {
        if (e.isIntersecting) {
          setStarted(true)
          io.disconnect()
        }
      },
      { threshold: 0.5 }
    )
    io.observe(el)
    return () => io.disconnect()
  }, [full])

  useEffect(() => {
    if (!started || n >= full.length) return
    // A human-ish rhythm: a beat before each new line, quick inside one.
    const delay = n > 0 && full[n - 1] === '\n' ? 380 : 24 + Math.random() * 36
    const id = window.setTimeout(() => setN((v) => v + 1), delay)
    return () => window.clearTimeout(id)
  }, [started, n, full])

  const typedLines = full.slice(0, n).split('\n')

  return (
    <pre
      ref={preRef}
      style={{
        margin: 0,
        padding: '20px 24px',
        borderRadius: 'var(--radius-lg)',
        // Inverted against the page in both themes.
        background: 'var(--ink)',
        color: 'var(--surface-page)',
        fontFamily: 'var(--font-mono)',
        fontSize: 'var(--text-xs)',
        lineHeight: 2,
        overflowX: 'auto'
      }}
    >
      <code>
        {typedLines.map((line, i) => {
          const lastLine = i === typedLines.length - 1
          return (
            <span key={i} style={{ display: 'block', whiteSpace: 'pre' }}>
              <span style={{ opacity: 0.45 }}>$ </span>
              {line}
              {lastLine && <span className="term-caret" />}
            </span>
          )
        })}
      </code>

      <style>{`
        .term-caret {
          display: inline-block;
          width: 7px;
          height: 1.05em;
          margin-left: 2px;
          vertical-align: text-bottom;
          background: currentColor;
          animation: term-blink 1.1s steps(1) infinite;
        }
        @keyframes term-blink {
          50% { opacity: 0; }
        }
      `}</style>
    </pre>
  )
}
