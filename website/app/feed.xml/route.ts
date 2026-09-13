import { NextResponse } from 'next/server'
import { changelogRss } from '@/lib/seo/documents'

export const dynamic = 'force-static'

export function GET(): NextResponse {
  return new NextResponse(changelogRss(), {
    headers: {
      'Content-Type': 'application/rss+xml; charset=utf-8',
      'Cache-Control': 'public, max-age=3600, s-maxage=86400'
    }
  })
}
