import { NextResponse } from 'next/server'
import { fileReport } from '@/lib/githubIssues'
import { allow } from '@/lib/rateLimit'
import { parseReport } from '@/lib/report'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

function clientIp(request: Request): string {
  const forwarded = request.headers.get('x-forwarded-for')
  if (forwarded) {
    const first = forwarded.split(',')[0]?.trim()
    if (first) return first
  }
  return request.headers.get('x-real-ip')?.trim() || 'unknown'
}

function isLineaAgent(ua: string): boolean {
  return ua.startsWith('Linea/')
}

export async function POST(request: Request) {
  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON.' }, { status: 400 })
  }

  const parsed = parseReport(body)
  if (!parsed.ok) {
    return NextResponse.json({ error: parsed.error }, { status: 400 })
  }
  if (parsed.spam) {
    return NextResponse.json({ ok: true })
  }

  const ua = request.headers.get('user-agent') ?? ''
  const limit = isLineaAgent(ua) ? 20 : 5
  if (!allow(`fb:${clientIp(request)}`, limit, 10 * 60 * 1000)) {
    return NextResponse.json({ error: 'Too many reports. Try again later.' }, { status: 429 })
  }

  const result = await fileReport(parsed.report)
  if (result.status === 503) {
    return NextResponse.json({ error: 'Reporting is not configured yet.' }, { status: 503 })
  }
  if (!result.ok) {
    return NextResponse.json({ error: 'Could not file the report.' }, { status: 502 })
  }

  return NextResponse.json({ ok: true })
}
