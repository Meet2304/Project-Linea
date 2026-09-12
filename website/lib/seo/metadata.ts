import type { Metadata } from 'next'
import {
  DESCRIPTION,
  KEYWORDS,
  OG_IMAGE,
  SITE_NAME,
  SITE_URL,
  TITLE,
  TWITTER_IMAGE,
  AUTHOR_NAME,
  AUTHOR_URL
} from '@/lib/site'

type OgType = 'website' | 'article'

export function buildMetadata({
  title,
  description,
  path,
  type = 'website',
  markdownPath
}: {
  title: string
  description: string
  path: string
  type?: OgType
  markdownPath?: string
}): Metadata {
  const url = path === '/' ? SITE_URL : `${SITE_URL}${path}`
  const markdown = markdownPath ?? (path === '/' ? '/index.md' : `${path}.md`)

  return {
    title,
    description,
    alternates: {
      canonical: url,
      types: {
        'text/markdown': `${SITE_URL}${markdown}`
      }
    },
    openGraph: {
      type,
      locale: 'en_US',
      url,
      title,
      description,
      siteName: SITE_NAME,
      images: [OG_IMAGE]
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description,
      images: [TWITTER_IMAGE]
    }
  }
}

export const rootMetadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: TITLE,
  description: DESCRIPTION,
  applicationName: SITE_NAME,
  authors: [{ name: AUTHOR_NAME, url: AUTHOR_URL }],
  creator: AUTHOR_NAME,
  publisher: AUTHOR_NAME,
  category: 'music',
  keywords: [...KEYWORDS],
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      'max-image-preview': 'large',
      'max-snippet': -1,
      'max-video-preview': -1
    }
  },
  ...buildMetadata({ title: TITLE, description: DESCRIPTION, path: '/' }),
  ...(process.env.GOOGLE_SITE_VERIFICATION
    ? { verification: { google: process.env.GOOGLE_SITE_VERIFICATION } }
    : {})
}
