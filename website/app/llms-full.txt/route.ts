import { NextResponse } from 'next/server'
import { llmsFullTxt } from '@/lib/seo/documents'

export const dynamic = 'force-static'

export function GET(): NextResponse {
  return new NextResponse(llmsFullTxt(), {
    headers: {
      'Content-Type': 'text/plain; charset=utf-8',
      'Cache-Control': 'public, max-age=3600, s-maxage=86400'
    }
  })
}
