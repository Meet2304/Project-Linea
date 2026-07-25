import { NextResponse } from 'next/server'
import { getReleaseInfo, RELEASE_REVALIDATE_SECONDS } from '@/lib/github'

/**
 * Proxy for the GitHub API.
 *
 * Doing this server-side keeps any token out of the browser and means the
 * public rate limit is consumed once per revalidation window rather than once
 * per visitor. It must never throw: before the first release is published the
 * releases endpoint 404s, and the download button falls back to
 * "build from source" on `{ tag: null }`.
 *
 * This is metadata only. Downloads go through /download, which resolves the
 * latest release per request so a cached answer here can never pin a visitor
 * to a superseded installer.
 */
export async function GET() {
  return NextResponse.json(await getReleaseInfo(), {
    headers: {
      'Cache-Control': `public, s-maxage=${RELEASE_REVALIDATE_SECONDS}, stale-while-revalidate=3600`
    }
  })
}
