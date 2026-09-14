import type { Metadata } from 'next'
import Nav from '@/components/Nav'
import Footer from '@/components/Footer'
import Faq from '@/components/faq/Faq'
import JsonLd from '@/components/seo/JsonLd'
import ThemeProvider from '@/components/theme/ThemeProvider'
import ReducedMotion from '@/components/motion/ReducedMotion'
import { breadcrumbJsonLd, faqJsonLd } from '@/lib/seo/jsonld'
import { buildMetadata } from '@/lib/seo/metadata'
import { FAQ_DESCRIPTION, FAQ_TITLE } from '@/lib/site'

export const metadata: Metadata = buildMetadata({
  title: FAQ_TITLE,
  description: FAQ_DESCRIPTION,
  path: '/faq'
})

export default function FaqPage() {
  return (
    <ThemeProvider>
      <ReducedMotion>
        <JsonLd data={faqJsonLd()} />
        <JsonLd
          data={breadcrumbJsonLd([
            { name: 'Linea', path: '/' },
            { name: 'FAQ', path: '/faq' }
          ])}
        />
        <Nav />
        <main>
          <Faq />
        </main>
        <Footer />
      </ReducedMotion>
    </ThemeProvider>
  )
}
