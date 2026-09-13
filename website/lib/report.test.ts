import { describe, expect, it } from 'bun:test'
import {
  crashMarker,
  crashSignature,
  emptyDiagnostics,
  issueBody,
  issueLabels,
  issueTitle,
  parseReport,
  repeatCrashComment,
  type Report
} from './report'

function report(over: Partial<Report> = {}): Report {
  return {
    kind: 'problem',
    message: 'Lyrics stuck on the previous song.',
    diagnostics: emptyDiagnostics(),
    ...over
  }
}

describe('parseReport', () => {
  it('treats a filled honeypot as spam without filing', () => {
    const parsed = parseReport({
      kind: 'problem',
      message: 'Lyrics stuck on the previous song.',
      company: 'Acme'
    })
    expect(parsed).toEqual({ ok: true, spam: true })
  })

  it('rejects a too-short description', () => {
    const parsed = parseReport({ kind: 'problem', message: 'nope' })
    expect(parsed.ok).toBe(false)
  })

  it('accepts an idea with a sentence', () => {
    const parsed = parseReport({ kind: 'idea', message: 'Let me pin a favourite lyric.' })
    expect(parsed.ok).toBe(true)
    if (parsed.ok && !parsed.spam) expect(parsed.report.kind).toBe('idea')
  })

  it('accepts a crash without a message when a crash kind is present', () => {
    const parsed = parseReport({
      kind: 'crash',
      message: '',
      diagnostics: { crashKind: 'render-process-gone', crashReason: 'crashed', version: '0.2.0' }
    })
    expect(parsed.ok).toBe(true)
    if (parsed.ok && !parsed.spam) {
      expect(parsed.report.diagnostics.crashKind).toBe('render-process-gone')
    }
  })

  it('rejects a crash without a crash kind', () => {
    expect(parseReport({ kind: 'crash', message: '' }).ok).toBe(false)
  })
})

describe('github issue shape', () => {
  it('titles from the first line and omits empty environment rows', () => {
    const body = issueBody(
      report({
        diagnostics: { ...emptyDiagnostics(), version: '0.2.0', os: 'Windows 11' }
      })
    )
    expect(issueTitle(report())).toBe('Lyrics stuck on the previous song.')
    expect(issueLabels('problem')).toEqual(['feedback', 'bug'])
    expect(issueLabels('idea')).toEqual(['feedback', 'enhancement'])
    expect(body).toContain('Lyrics stuck on the previous song.')
    expect(body).toContain('- Linea: 0.2.0')
    expect(body).toContain('- OS: Windows 11')
    expect(body).not.toContain('Player:')
  })

  it('marks crashes for grouping and comments on a repeat', () => {
    const crash = report({
      kind: 'crash',
      message: '',
      diagnostics: {
        ...emptyDiagnostics(),
        version: '0.2.0',
        crashKind: 'render-process-gone',
        crashReason: 'crashed',
        player: 'Spotify'
      }
    })
    const signature = crashSignature(crash)
    expect(signature).toBe('linea-crash:render-process-gone:crashed:0.2.0')
    expect(issueTitle(crash)).toBe('Crash: render-process-gone (crashed) · 0.2.0')
    expect(issueLabels('crash')).toEqual(['crash', 'bug'])
    expect(issueBody(crash)).toContain(crashMarker(signature))
    expect(issueBody(crash)).toContain('_Auto-sent after Linea recovered._')
    expect(repeatCrashComment(crash)).toContain('Seen again.')
    expect(repeatCrashComment(crash)).toContain('- Player: Spotify')
  })
})
