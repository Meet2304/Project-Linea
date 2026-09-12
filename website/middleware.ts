import type { NextRequest } from 'next/server'
import { NextResponse } from 'next/server'

/**
 * Agents that send Accept: text/markdown get the indexable document instead
 * of the canvas-heavy marketing HTML. Browsers ask for text/html and stay
 * on the designed pages.
 */
const MARKDOWN: Record<string, string> = {
  '/': '/index.md',
  '/faq': '/faq.md',
  '/changelog': '/changelog.md'
}

export function middleware(request: NextRequest): NextResponse {
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
  matcher: ['/', '/faq', '/changelog']
}
