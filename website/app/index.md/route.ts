import { NextResponse } from 'next/server'
import { indexMarkdown } from '@/lib/seo/documents'

export const dynamic = 'force-static'

export function GET(): NextResponse {
  return new NextResponse(indexMarkdown(), {
    headers: {
      'Content-Type': 'text/markdown; charset=utf-8',
      'Cache-Control': 'public, max-age=3600, s-maxage=86400'
    }
  })
}
