import { app } from 'electron'
import {
  clip,
  CrashDeduper,
  crashSignature,
  diagnosticsFromSnapshot,
  type OsInfo,
  type ReportDiagnostics,
  type ReportKind,
  type SubmitResult
} from '../shared/report'
import type { PlaybackSnapshot } from '../shared/types'

export const DEFAULT_FEEDBACK_URL = 'https://project-linea.vercel.app/api/feedback'

export function feedbackEndpoint(
  isPackaged: boolean,
  env: NodeJS.ProcessEnv = process.env
): string | null {
  const override = env.LINEA_FEEDBACK_URL?.trim()
  if (override) return override
  return isPackaged ? DEFAULT_FEEDBACK_URL : null
}

export async function submitReport(input: {
  kind: ReportKind
  message: string
  diagnostics: ReportDiagnostics
}): Promise<SubmitResult> {
  const url = feedbackEndpoint(app.isPackaged, process.env)
  if (!url) return { ok: true }

  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': `Linea/${app.getVersion()} (https://github.com/Meet2304/Project-Linea)`
      },
      body: JSON.stringify({
        kind: input.kind,
        message: input.message,
        diagnostics: input.diagnostics
      }),
      signal: AbortSignal.timeout(15_000)
    })
    if (res.ok) return { ok: true }
    const data: unknown = await res.json().catch(() => null)
    const error =
      data && typeof data === 'object' && 'error' in data && typeof data.error === 'string'
        ? data.error
        : 'Could not send.'
    return { ok: false, error }
  } catch {
    return { ok: false, error: 'Could not send.' }
  }
}

const crashDeduper = new CrashDeduper()

/** Fire-and-forget. Grouped locally (one POST per signature per hour) and again on the server. */
export function reportCrash(input: {
  crashKind: string
  crashReason: string
  os: OsInfo
  snapshot: PlaybackSnapshot | null
}): void {
  const crashKind = clip(input.crashKind)
  const crashReason = clip(input.crashReason)
  if (!crashKind) return
  const signature = crashSignature(crashKind, crashReason, input.os.version)
  if (!crashDeduper.allow(signature)) return
  const diagnostics: ReportDiagnostics = {
    ...diagnosticsFromSnapshot(input.os, input.snapshot),
    crashKind,
    crashReason
  }
  void submitReport({ kind: 'crash', message: '', diagnostics }).then((result) => {
    if (!result.ok) console.error('Crash report failed:', result.error)
  })
}
