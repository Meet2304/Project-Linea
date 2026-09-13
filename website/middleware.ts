import type { NextRequest } from 'next/server'
import { NextResponse } from 'next/server'
import { SITE_HOST } from '@/lib/site'

/**
 * Agents that send Accept: text/markdown get the indexable document instead
 * of the canvas-heavy marketing HTML. Browsers ask for text/html and stay
 * on the designed pages.
 *
 * The old Vercel host and a www prefix 308 to linea.meetbhatt.com so Google
 * never treats two origins as the same site.
 */
const MARKDOWN: Record<string, string> = {
  '/': '/index.md',
  '/faq': '/faq.md',
  '/changelog': '/changelog.md'
}

const LEGACY_HOSTS = new Set(['project-linea.vercel.app', `www.${SITE_HOST}`])

export function middleware(request: NextRequest): NextResponse {
  const host = request.headers.get('host')?.split(':')[0] ?? ''
  if (LEGACY_HOSTS.has(host)) {
    const url = request.nextUrl.clone()
    url.protocol = 'https:'
    url.hostname = SITE_HOST
    url.port = ''
    return NextResponse.redirect(url, 308)
  }

  const accept = request.headers.get('accept') ?? ''
  const wantsMarkdown = accept.includes('text/markdown') && !accept.includes('text/html')
  const rewriteTo = MARKDOWN[request.nextUrl.pathname]
  if (wantsMarkdown && rewriteTo) {
    const url = request.nextUrl.clone()
    url.pathname = rewriteTo
    return NextResponse.rewrite(url)
  }
  return NextResponse.next()
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|.*\\.(?:png|ico|jpg|jpeg|svg|webp)$).*)']
}
