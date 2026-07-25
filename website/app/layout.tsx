import type { Metadata, Viewport } from 'next'
import { Outfit, Space_Mono } from 'next/font/google'
import LoadingVeil from '@/components/loader/LoadingVeil'
import './globals.css'

const outfit = Outfit({
  subsets: ['latin'],
  weight: ['300', '400', '500', '600', '700'],
  variable: '--font-outfit',
  display: 'swap'
})

const spaceMono = Space_Mono({
  subsets: ['latin'],
  weight: ['400', '700'],
  variable: '--font-space-mono',
  display: 'swap'
})

const TITLE = 'Linea — know every word'
const DESCRIPTION =
  'Live Spotify lyrics, floating over everything you do. A lightweight, open-source desktop overlay for Windows and macOS.'

export const metadata: Metadata = {
  metadataBase: new URL('https://linea.vercel.app'),
  title: TITLE,
  description: DESCRIPTION,
  applicationName: 'Linea',
  authors: [{ name: 'Meet Bhatt', url: 'https://github.com/Meet2304' }],
  keywords: [
    'Linea',
    'Spotify lyrics',
    'lyrics overlay',
    'desktop overlay',
    'synced lyrics',
    'Electron',
    'open source'
  ],
  openGraph: {
    type: 'website',
    title: TITLE,
    description: DESCRIPTION,
    siteName: 'Linea',
    images: [
      {
        url: '/social/linea-whatsapp-og.png',
        width: 1200,
        height: 630,
        alt: 'Linea — know every word'
      }
    ]
  },
  twitter: {
    card: 'summary_large_image',
    title: TITLE,
    description: DESCRIPTION,
    images: ['/social/linea-x-social.png']
  }
}

export const viewport: Viewport = {
  themeColor: '#ffffff',
  colorScheme: 'light'
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${outfit.variable} ${spaceMono.variable}`}>
      <body>
        {/* In the first HTML payload on purpose: it covers the page before
            hydration, while everything beneath it finishes assembling. */}
        <LoadingVeil />
        {children}
      </body>
    </html>
  )
}
