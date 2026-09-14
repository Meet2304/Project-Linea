import { NextResponse } from 'next/server'
import { productJson } from '@/lib/seo/documents'

export const dynamic = 'force-static'

export function GET(): NextResponse {
  return NextResponse.json(productJson(), {
    headers: {
      'Cache-Control': 'public, max-age=3600, s-maxage=86400'
    }
  })
}
