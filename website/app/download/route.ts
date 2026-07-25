import { NextResponse, type NextRequest } from 'next/server'
import { latestAssetUrl } from '@/lib/github'
import { RELEASES_URL } from '@/lib/release'

/**
 * Redirects to the current latest installer for `?platform=win|mac`.
 *
 * The download button used to link straight at a `browser_download_url`, which
 * pins a specific version. That URL is baked into the page's HTML, so an
 * ISR-cached page kept serving the previous release's installer after a new one
 * shipped — v0.1.0 (which launched to a blank panel) was still being handed out
 * after v0.1.1 fixed it.
 *
 * Resolving here instead means the version is decided when the visitor clicks,
 * not when the page was last rendered. Being a plain link, it also still works
 * with JavaScript disabled.
 */

// Must never be prerendered or cached — that would reintroduce the staleness
// this route exists to remove.
export const dynamic = 'force-dynamic'
export const revalidate = 0

const NO_STORE = { 'Cache-Control': 'no-store, max-age=0, must-revalidate' }

export async function GET(request: NextRequest): Promise<NextResponse> {
  const requested = request.nextUrl.searchParams.get('platform')
  const platform = requested === 'win' || requested === 'mac' ? requested : null

  // Unknown platform (or Linux, which has no build target): send them to the
  // Releases page to choose for themselves rather than 404.
  const target = platform ? ((await latestAssetUrl(platform)) ?? RELEASES_URL) : RELEASES_URL

  return NextResponse.redirect(target, { status: 302, headers: NO_STORE })
}
