import { app } from 'electron'

/**
 * lrclib asks clients to identify themselves and fronts its API with a WAF
 * that drops requests it cannot attribute; NetEase is likewise happier with a
 * real agent. Without this the request carries the runtime's default, which is
 * exactly the traffic that gets dropped — and the failure is indistinguishable
 * from "this track has no lyrics".
 */
export const USER_AGENT = `Linea/${app.getVersion()} (https://github.com/Meet2304/Project-Linea)`

/**
 * `http` means we reached the server and it answered (even 404 or 503).
 * `transport` means we never got there at all — DNS, TLS, timeout, abort.
 *
 * The split is the point: this layer never decides what a 404 *means*. Only
 * the provider knows whether a given endpoint's 404 is "no such track" or
 * "this API is broken", so status interpretation stays with the caller.
 */
export type FetchOutcome =
  | { kind: 'json'; status: number; body: unknown }
  | { kind: 'http'; status: number }
  | { kind: 'transport' }

interface FetchOptions {
  signal: AbortSignal
  timeoutMs: number
  headers?: Record<string, string>
}

export async function fetchJson(url: URL, opts: FetchOptions): Promise<FetchOutcome> {
  // Whichever fires first wins: the chain's overall deadline or this request's
  // own budget. Under SNI interception a connection hangs rather than
  // resetting, so the per-request timeout is what keeps the chain moving.
  const signal = AbortSignal.any([opts.signal, AbortSignal.timeout(opts.timeoutMs)])

  let response: Response
  try {
    response = await fetch(url, {
      headers: { 'User-Agent': USER_AGENT, ...opts.headers },
      signal
    })
  } catch {
    return { kind: 'transport' }
  }

  if (!response.ok) return { kind: 'http', status: response.status }

  // A 200 carrying unparseable content is a broken service, not an answer
  // about the track — report it as such rather than as an empty result.
  try {
    return { kind: 'json', status: response.status, body: await response.json() }
  } catch {
    return { kind: 'http', status: response.status }
  }
}
