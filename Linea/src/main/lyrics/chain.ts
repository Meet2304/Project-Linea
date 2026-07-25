import type { LyricLine, LyricsResult } from '../../shared/lyrics'
import type { LyricsProvider, LyricsQuery, ProviderId, ProviderOutcome } from './types'

/**
 * Runs lyrics providers in order and combines their outcomes into one honest
 * answer.
 *
 * The rule that matters: `unreachable` is reported only when we genuinely
 * learned nothing. If any provider actually answered "no match", the honest
 * status is `none` — we asked someone who knows and they said no.
 */

const TOTAL_BUDGET_MS = 12_000
/** Below this there is no point starting another provider. */
const MIN_PROVIDER_BUDGET_MS = 1_500

// ------------------------------------------------------------------
// Circuit breaker
//
// Under SNI interception (the case that motivated all this) a blocked host
// hangs until timeout rather than failing fast, so every track change would
// otherwise pay the full first-provider timeout before the fallback is even
// tried. Tripping a dead provider is what makes the fallback feel immediate.
// In-memory only: a network-level block may well be gone next launch, and
// persisting the trip would outlive the outage.
// ------------------------------------------------------------------
const TRIP_AFTER_FAILURES = 3
const TRIP_DURATION_MS = 5 * 60_000

interface BreakerEntry {
  failures: number
  trippedUntil: number
}

const breakers = new Map<ProviderId, BreakerEntry>()

function entryFor(id: ProviderId): BreakerEntry {
  const existing = breakers.get(id)
  if (existing) return existing
  const created = { failures: 0, trippedUntil: 0 }
  breakers.set(id, created)
  return created
}

export function noteOutcome(id: ProviderId, kind: ProviderOutcome['kind'], now: number): void {
  const entry = entryFor(id)
  if (kind === 'unreachable') {
    entry.failures++
    if (entry.failures >= TRIP_AFTER_FAILURES) entry.trippedUntil = now + TRIP_DURATION_MS
    return
  }
  // Any real answer proves the provider is alive.
  entry.failures = 0
  entry.trippedUntil = 0
}

export function isTripped(id: ProviderId, now: number): boolean {
  return entryFor(id).trippedUntil > now
}

/** Test seam — breaker state is process-wide by design. */
export function resetBreakers(): void {
  breakers.clear()
}

/**
 * Providers may return lines in any order, and NetEase interleaves metadata
 * rows. One normalization pass keeps the scheduler's assumptions intact.
 */
function normalizeLines(lines: LyricLine[]): LyricLine[] {
  return lines
    .filter((line) => Number.isFinite(line.timeMs) && line.timeMs >= 0)
    .sort((a, b) => a.timeMs - b.timeMs)
}

export interface ChainOptions {
  totalBudgetMs?: number
  now?: () => number
}

export interface ChainResult {
  result: LyricsResult
  /** Which provider produced the lines; null when none did. */
  provider: ProviderId | null
}

/**
 * Providers are a parameter rather than an import so tests can stub them and
 * so dropping a flaky provider is a one-line change at the call site.
 */
export async function resolveLyrics(
  query: LyricsQuery,
  providers: readonly LyricsProvider[],
  opts: ChainOptions = {}
): Promise<ChainResult> {
  const now = opts.now ?? Date.now
  const budget = opts.totalBudgetMs ?? TOTAL_BUDGET_MS
  const deadline = now() + budget

  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), budget)

  // Tracks whether anyone gave us real information about this track. This is
  // the difference between "nobody has lyrics" and "nobody answered".
  let heardAnAnswer = false

  try {
    for (const provider of providers) {
      if (isTripped(provider.id, now())) continue
      if (deadline - now() < MIN_PROVIDER_BUDGET_MS) continue

      const outcome = await provider.lookup(query, controller.signal)
      noteOutcome(provider.id, outcome.kind, now())

      switch (outcome.kind) {
        case 'lyrics': {
          const lines = normalizeLines(outcome.lines)
          // A provider claiming lyrics but yielding nothing parseable told us
          // nothing useful about the track — keep looking.
          if (lines.length > 0) {
            return { result: { lines, status: 'ok' }, provider: provider.id }
          }
          heardAnAnswer = true
          break
        }
        case 'instrumental':
          // Authoritative — no other source can have lyrics for this track.
          return { result: { lines: [], status: 'none' }, provider: null }
        case 'no-match':
          heardAnAnswer = true
          break
        case 'unreachable':
          break
      }
    }
  } finally {
    clearTimeout(timer)
  }

  return {
    result: { lines: [], status: heardAnAnswer ? 'none' : 'unreachable' },
    provider: null
  }
}
