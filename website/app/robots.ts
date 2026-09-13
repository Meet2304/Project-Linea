import type { MetadataRoute } from 'next'
import { AI_USER_AGENTS, SITE_URL } from '@/lib/site'

const disallow = ['/share/', '/api/lyrics', '/api/release']

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      { userAgent: '*', allow: '/', disallow },
      ...AI_USER_AGENTS.map((userAgent) => ({
        userAgent,
        allow: '/'
      }))
    ],
    sitemap: `${SITE_URL}/sitemap.xml`,
    host: SITE_URL
  }
}
