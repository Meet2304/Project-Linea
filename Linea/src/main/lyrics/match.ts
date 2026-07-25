import type { LyricsQuery } from './types'

/**
 * Pure candidate matching for fuzzy provider searches. No I/O, no clock.
 *
 * The stakes are asymmetric: showing the *wrong* lyrics scrolling against a
 * song is far worse than showing none, and provider search endpoints are
 * happy to answer nonsense queries with confident garbage (NetEase returns a
 * real track for "zzzqqqxxxnonexistent"). So the component floors below are
 * hard rejects, not penalties — a candidate that fails any of them scores 0
 * and can never be selected regardless of how well it does elsewhere.
 */

export interface Candidate {
  trackName: string
  artistName: string
  albumName?: string
  /** Seconds. <= 0 means the provider did not report one. */
  durationSec: number
  hasSynced: boolean
  instrumental?: boolean
}

/**
 * Qualifiers that make a trailing " - ..." segment editorial rather than part
 * of the title. These describe a different *release* of the same performance,
 * so the lyrics still apply — unlike DERIVATIVE_MARKERS below.
 */
const EDITION_WORDS =
  /(remaster|remastered|live|version|edit|mono|stereo|deluxe|acoustic|single|album|bonus|demo|radio|explicit|extended|anniversary)/

const FEAT_TAIL = /\s(?:feat|ft|featuring|with)\.?\s.*$/

/**
 * Markers of a *different recording* that merely borrows the title: karaoke
 * backings, instrumentals, remixes, covers and "tribute" filler.
 *
 * These are the single biggest source of wrong lyrics. Because containment
 * scores 0.85, "Bohemian Rhapsody Karaoke" would otherwise clear every
 * threshold against a query for "Bohemian Rhapsody". Tested against the raw
 * string before normalization, since the marker usually sits in parentheses
 * that normalizeName strips.
 */
const DERIVATIVE_MARKERS =
  /(karaoke|instrumental|off vocal|backing track|\bremix\b|\bcover\b|tribute|originally performed|made (?:famous|popular) by|in the style of|伴奏)/

function hasDerivativeMarker(value: string): boolean {
  return DERIVATIVE_MARKERS.test(value.toLowerCase())
}

/**
 * Reduce a title or artist to its comparable core.
 *
 * Providers and Spotify disagree constantly on decoration — "(Remastered
 * 2011)", "[Live]", "- Radio Edit", "feat. X" — while naming the same
 * recording. Stripping it from both sides is symmetric, so nothing is lost by
 * doing it aggressively.
 */
export function normalizeName(value: string): string {
  return (
    value
      .toLowerCase()
      // Decompose so accents become separate combining marks, then drop them:
      // "Beyoncé" and "Beyonce" must compare equal.
      .normalize('NFKD')
      .replace(/\p{M}+/gu, '')
      .replace(/\([^)]*\)/g, ' ')
      .replace(/\[[^\]]*\]/g, ' ')
      .replace(FEAT_TAIL, ' ')
      // Only strip a trailing dash segment when it actually reads as an
      // edition marker — "Alvvays - Archie, Marry Me" must survive intact.
      .replace(/\s[-–—]\s[^-–—]*$/, (tail) => (EDITION_WORDS.test(tail) ? ' ' : tail))
      // Keep letters and numbers of every script (CJK included); everything
      // else becomes a separator.
      .replace(/[^\p{L}\p{N}]+/gu, ' ')
      .trim()
  )
}

function tokens(value: string): string[] {
  return value.length === 0 ? [] : value.split(' ')
}

function jaccard(a: string, b: string): number {
  const left = new Set(tokens(a))
  const right = new Set(tokens(b))
  if (left.size === 0 || right.size === 0) return 0
  let shared = 0
  for (const token of left) if (right.has(token)) shared++
  return shared / (left.size + right.size - shared)
}

/**
 * Exact → 1, containment → 0.85, otherwise token overlap. Containment scores
 * high because providers routinely list every credited artist ("Queen, David
 * Bowie") where Spotify hands us only the primary one.
 */
function similarity(a: string, b: string): number {
  if (a.length === 0 || b.length === 0) return 0
  if (a === b) return 1
  if (a.includes(b) || b.includes(a)) return 0.85
  return jaccard(a, b)
}

const TITLE_FLOOR = 0.6
const ARTIST_FLOOR = 0.5
/** Beyond this many seconds apart it is a different recording, not a different master. */
const DURATION_TOLERANCE_SEC = 15
/** Allowed only when title and artist both match exactly — album vs single edits. */
const DURATION_TOLERANCE_EXACT_SEC = 25

export function durationDeltaSec(candidate: Candidate, query: LyricsQuery): number {
  return Math.abs(candidate.durationSec - query.durationSec)
}

/** 0 means rejected — never selectable. */
export function scoreCandidate(candidate: Candidate, query: LyricsQuery): number {
  // A karaoke or remix entry is only acceptable if that is what is actually
  // playing — so compare against the query rather than rejecting outright.
  if (
    hasDerivativeMarker(`${candidate.trackName} ${candidate.artistName}`) &&
    !hasDerivativeMarker(`${query.trackName} ${query.artistName}`)
  ) {
    return 0
  }

  const title = similarity(normalizeName(candidate.trackName), normalizeName(query.trackName))
  if (title < TITLE_FLOOR) return 0

  const artist = similarity(normalizeName(candidate.artistName), normalizeName(query.artistName))
  if (artist < ARTIST_FLOOR) return 0

  // A provider that reports no duration gives us nothing to confirm or deny,
  // so treat it as neutral rather than as evidence either way.
  const durationKnown = candidate.durationSec > 0 && query.durationSec > 0
  let durationScore = 0.5
  if (durationKnown) {
    const delta = durationDeltaSec(candidate, query)
    const exactNames = title === 1 && artist === 1
    const tolerance = exactNames ? DURATION_TOLERANCE_EXACT_SEC : DURATION_TOLERANCE_SEC
    if (delta > tolerance) return 0
    durationScore = Math.max(0, 1 - delta / DURATION_TOLERANCE_SEC)
  }

  const albumBonus =
    candidate.albumName && normalizeName(candidate.albumName) === normalizeName(query.albumName)
      ? 0.05
      : 0

  return Math.min(1, 0.45 * title + 0.35 * artist + 0.2 * durationScore + albumBonus)
}

export interface Match {
  index: number
  score: number
}

/**
 * Best candidate at or above `minScore`, or null.
 *
 * Candidates without synced lyrics are excluded outright — Linea is a synced
 * overlay, and a plain-lyrics hit here would block a later provider that has
 * a properly timed version.
 */
export function pickBest(
  candidates: readonly Candidate[],
  query: LyricsQuery,
  minScore: number,
  maxDurationDeltaSec = Infinity
): Match | null {
  let best: Match | null = null
  let bestDelta = Infinity

  for (let index = 0; index < candidates.length; index++) {
    const candidate = candidates[index]
    if (!candidate?.hasSynced) continue
    if (candidate.durationSec > 0 && durationDeltaSec(candidate, query) > maxDurationDeltaSec) {
      continue
    }

    const score = scoreCandidate(candidate, query)
    if (score < minScore) continue

    const delta = candidate.durationSec > 0 ? durationDeltaSec(candidate, query) : Infinity
    // Ties go to the closer duration, then to the provider's own ordering,
    // which is relevance-sorted.
    if (best === null || score > best.score || (score === best.score && delta < bestDelta)) {
      best = { index, score }
      bestDelta = delta
    }
  }

  return best
}
