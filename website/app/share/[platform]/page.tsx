import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import HomePage from '@/app/page'

const TITLE = 'Linea — know every word'
const DESCRIPTION =
  'Live Spotify lyrics, floating over everything you do. A lightweight, open-source desktop overlay for Windows and macOS.'

const shareImages = {
  whatsapp: { image: '/social/linea-whatsapp-og.png', width: 1200, height: 630 },
  facebook: { image: '/social/linea-facebook-og.png', width: 1200, height: 630 },
  linkedin: { image: '/social/linea-linkedin-og.png', width: 1200, height: 627 },
  slack: { image: '/social/linea-slack-og.png', width: 1200, height: 630 },
  x: { image: '/social/linea-x-social.png', width: 1500, height: 750 }
} as const

type Platform = keyof typeof shareImages

function isPlatform(value: string): value is Platform {
  return value in shareImages
}

export function generateStaticParams() {
  return Object.keys(shareImages).map((platform) => ({ platform }))
}

export async function generateMetadata({
  params
}: {
  params: Promise<{ platform: string }>
}): Promise<Metadata> {
  const { platform } = await params
  if (!isPlatform(platform)) return {}

  const asset = shareImages[platform]
  return {
    title: TITLE,
    description: DESCRIPTION,
    alternates: { canonical: '/' },
    robots: { index: false, follow: true },
    openGraph: {
      type: 'website',
      title: TITLE,
      description: DESCRIPTION,
      siteName: 'Linea',
      images: [
        {
          url: asset.image,
          width: asset.width,
          height: asset.height,
          alt: 'Linea — know every word'
        }
      ]
    },
    twitter: {
      card: 'summary_large_image',
      title: TITLE,
      description: DESCRIPTION,
      images: [asset.image]
    }
  }
}

export default async function PlatformSharePage({
  params
}: {
  params: Promise<{ platform: string }>
}) {
  const { platform } = await params
  if (!isPlatform(platform)) notFound()
  return <HomePage />
}
