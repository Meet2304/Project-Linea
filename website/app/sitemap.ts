import type { MetadataRoute } from 'next'
import { RELEASES } from '@/components/changelog/releases'
import { SITE_URL } from '@/lib/site'

function lastReleaseDate(): Date {
  const iso = RELEASES[0]?.date
  return iso ? new Date(`${iso}T12:00:00.000Z`) : new Date()
}

export default function sitemap(): MetadataRoute.Sitemap {
  const latest = lastReleaseDate()
  return [
    {
      url: SITE_URL,
      lastModified: latest,
      changeFrequency: 'weekly',
      priority: 1
    },
    {
      url: `${SITE_URL}/faq`,
      lastModified: latest,
      changeFrequency: 'monthly',
      priority: 0.8
    },
    {
      url: `${SITE_URL}/changelog`,
      lastModified: latest,
      changeFrequency: 'weekly',
      priority: 0.7
    }
  ]
}
