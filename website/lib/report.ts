import { SITE_URL } from './release'

export const REPORT_KINDS = ['problem', 'idea', 'crash'] as const
export type ReportKind = (typeof REPORT_KINDS)[number]

export const MIN_MESSAGE = 8
export const MAX_MESSAGE = 2_000
export const MAX_FIELD = 300

export interface ReportDiagnostics {
  version: string
  os: string
  player: string
  song: string
  lyrics: string
  source: string
  controls: string
  crashKind: string
  crashReason: string
}

export interface Report {
  kind: ReportKind
  message: string
  diagnostics: ReportDiagnostics
}

export type ParseResult =
  | { ok: true; spam: true }
  | { ok: true; spam: false; report: Report }
  | { ok: false; error: string }

const KIND_SET = new Set<string>(REPORT_KINDS)

export function clip(value: string, max = MAX_FIELD): string {
  return value.trim().slice(0, max)
}

export function emptyDiagnostics(): ReportDiagnostics {
  return {
    version: '',
    os: '',
    player: '',
    song: '',
    lyrics: '',
    source: '',
    controls: '',
    crashKind: '',
    crashReason: ''
  }
}

function readDiagnostics(value: unknown): ReportDiagnostics {
  const out = emptyDiagnostics()
  if (!value || typeof value !== 'object') return out
  const rec = value as Record<string, unknown>
  for (const key of Object.keys(out) as (keyof ReportDiagnostics)[]) {
    const raw = rec[key]
    if (typeof raw === 'string') out[key] = clip(raw)
  }
  return out
}

export function parseReport(value: unknown): ParseResult {
  if (!value || typeof value !== 'object') return { ok: false, error: 'Invalid report' }
  const rec = value as Record<string, unknown>

  if (typeof rec.company === 'string' && rec.company.trim() !== '') {
    return { ok: true, spam: true }
  }

  const kind = rec.kind
  if (typeof kind !== 'string' || !KIND_SET.has(kind)) {
    return { ok: false, error: 'Choose problem, idea, or crash' }
  }

  const message = typeof rec.message === 'string' ? clip(rec.message, MAX_MESSAGE) : ''
  const diagnostics = readDiagnostics(rec.diagnostics)
  const report: Report = { kind: kind as ReportKind, message, diagnostics }

  if (report.kind === 'crash') {
    if (!diagnostics.crashKind) return { ok: false, error: 'Crash reports need a crash kind' }
  } else if (message.length < MIN_MESSAGE) {
    return { ok: false, error: 'A short sentence is enough.' }
  }

  return { ok: true, spam: false, report }
}

export function crashSignature(report: Report): string {
  if (report.kind !== 'crash') return ''
  const part = (value: string): string =>
    value.trim().toLowerCase().replace(/\s+/g, '-').slice(0, 80)
  return `linea-crash:${part(report.diagnostics.crashKind)}:${part(report.diagnostics.crashReason)}:${part(report.diagnostics.version)}`
}

export function crashMarker(signature: string): string {
  return `<!-- ${signature} -->`
}

export function issueLabels(kind: ReportKind): string[] {
  if (kind === 'idea') return ['feedback', 'enhancement']
  if (kind === 'crash') return ['crash', 'bug']
  return ['feedback', 'bug']
}

export function issueTitle(report: Report): string {
  if (report.kind === 'crash') {
    const kind = report.diagnostics.crashKind || 'unknown'
    const reason = report.diagnostics.crashReason
    const version = report.diagnostics.version
    const head = reason && reason !== kind ? `Crash: ${kind} (${reason})` : `Crash: ${kind}`
    return (version ? `${head} · ${version}` : head).slice(0, 120)
  }
  const first = report.message.split(/\n/)[0]?.trim() ?? ''
  if (first) return first.slice(0, 80)
  return report.kind === 'idea' ? 'Idea' : 'Problem report'
}

function envLine(label: string, value: string): string | null {
  const v = clip(value)
  return v ? `- ${label}: ${v}` : null
}

export function issueBody(report: Report): string {
  const d = report.diagnostics
  const environment = [
    envLine('Linea', d.version),
    envLine('OS', d.os),
    envLine('Player', d.player),
    envLine('Song', d.song),
    envLine('Lyrics', d.lyrics),
    envLine('Source', d.source),
    envLine('Controls', d.controls),
    envLine(
      'Crash',
      d.crashKind ? `${d.crashKind}${d.crashReason ? ` · ${d.crashReason}` : ''}` : ''
    )
  ].filter((row): row is string => row !== null)

  const what =
    report.message ||
    (report.kind === 'crash' ? '_Auto-sent after Linea recovered._' : '_Not described._')

  const origin = report.kind === 'crash' ? 'an automatic crash report' : 'the Linea feedback form'

  const parts = [
    '### What happened',
    '',
    what,
    '',
    '### Environment',
    '',
    environment.length > 0 ? environment.join('\n') : '_Not attached._'
  ]

  const signature = crashSignature(report)
  if (signature) {
    parts.push('', crashMarker(signature))
  }

  parts.push(
    '',
    '---',
    '',
    `Filed from ${origin}. Public issue — don't include passwords or API keys.`,
    SITE_URL
  )

  return parts.join('\n')
}

export function repeatCrashComment(report: Report): string {
  const d = report.diagnostics
  const extras = [
    envLine('Linea', d.version),
    envLine('OS', d.os),
    envLine('Player', d.player),
    envLine('Song', d.song)
  ].filter((row): row is string => row !== null)
  return [
    'Seen again.',
    '',
    extras.length > 0 ? extras.join('\n') : '_No extra environment._'
  ].join('\n')
}
