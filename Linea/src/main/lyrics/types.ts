import type { LyricLine } from '../../shared/lyrics'

export type ProviderId = 'lrclib' | 'netease'

export interface LyricsQuery {
  trackName: string
  artistName: string
  albumName: string
  durationSec: number
}

/**
 * The distinction this whole feature rests on.
 *
 * `no-match` is an answer *about the track* — the provider looked and found
 * nothing synced. `unreachable` is the absence of an answer about anything;
 * we learned nothing, so we must not claim the track has no lyrics. Collapsing
 * the two is the bug fixed in v0.1.3, pushed down to per-provider granularity
 * so the chain can tell "nobody has it" from "nobody answered".
 */
export type ProviderOutcome =
  | { kind: 'lyrics'; lines: LyricLine[] }
  /** Authoritative: the track has no lyrics at all, so no other source will help. */
  | { kind: 'instrumental' }
  | { kind: 'no-match' }
  | { kind: 'unreachable' }

export interface LyricsProvider {
  readonly id: ProviderId
  /**
   * Never throws — every failure is mapped to an outcome so the chain stays
   * free of try/catch. `signal` carries the chain's overall deadline.
   */
  lookup(query: LyricsQuery, signal: AbortSignal): Promise<ProviderOutcome>
}
