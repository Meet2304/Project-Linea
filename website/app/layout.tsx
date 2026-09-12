import type { Metadata, Viewport } from 'next'
import { Outfit, Space_Mono } from 'next/font/google'
import LoadingVeil from '@/components/loader/LoadingVeil'
import JsonLd from '@/components/seo/JsonLd'
import { siteGraphJsonLd } from '@/lib/seo/jsonld'
import { rootMetadata } from '@/lib/seo/metadata'
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

export const metadata: Metadata = rootMetadata

export const viewport: Viewport = {
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#ffffff' },
    { media: '(prefers-color-scheme: dark)', color: '#0c0d10' }
  ],
  colorScheme: 'light dark'
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${outfit.variable} ${spaceMono.variable}`}>
      <body>
        <JsonLd data={siteGraphJsonLd()} />
        <a className="skip-to-content" href="#top">
          Skip to content
        </a>
        <noscript>
          <style>{`.loading-veil{display:none!important}`}</style>
        </noscript>
        {/* In the first HTML payload on purpose: it covers the page before
            hydration, while everything beneath it finishes assembling. */}
        <LoadingVeil />
        {children}
      </body>
    </html>
  )
}
