import type { Metadata, Viewport } from 'next'
import { Outfit, Space_Mono } from 'next/font/google'
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

const DESCRIPTION =
  'Linea is a lightweight desktop overlay that shows the lyrics of whatever you are playing on Spotify, in time, on top of whatever you are doing.'

export const metadata: Metadata = {
  metadataBase: new URL('https://linea.vercel.app'),
  title: 'Linea — your music, as a quiet layer',
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
    title: 'Linea — your music, as a quiet layer',
    description: DESCRIPTION,
    siteName: 'Linea'
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Linea — your music, as a quiet layer',
    description: DESCRIPTION
  }
}

export const viewport: Viewport = {
  themeColor: '#ffffff',
  colorScheme: 'light'
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${outfit.variable} ${spaceMono.variable}`}>
      <body>{children}</body>
    </html>
  )
}
