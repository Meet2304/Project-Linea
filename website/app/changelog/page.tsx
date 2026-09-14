import type { Metadata } from 'next'
import Nav from '@/components/Nav'
import Changelog from '@/components/changelog/Changelog'
import JsonLd from '@/components/seo/JsonLd'
import ThemeProvider from '@/components/theme/ThemeProvider'
import ReducedMotion from '@/components/motion/ReducedMotion'
import { RELEASES } from '@/components/changelog/releases'
import { breadcrumbJsonLd, changelogJsonLd } from '@/lib/seo/jsonld'
import { buildMetadata } from '@/lib/seo/metadata'
import { CHANGELOG_DESCRIPTION, CHANGELOG_TITLE, SITE_URL } from '@/lib/site'

const base = buildMetadata({
  title: CHANGELOG_TITLE,
  description: CHANGELOG_DESCRIPTION,
  path: '/changelog',
  type: 'article'
})

export const metadata: Metadata = {
  ...base,
  alternates: {
    ...base.alternates,
    types: {
      ...base.alternates?.types,
      'application/rss+xml': `${SITE_URL}/feed.xml`
    }
  }
}

/**
 * The page has no Footer on purpose. Every screen here is a snap target
 * exactly one viewport tall, and a short trailing footer would either sit
 * outside the flick sequence or break it — so the closing screen carries the
 * sign-off links instead.
 */
export default function ChangelogPage() {
  return (
    <ThemeProvider>
      <ReducedMotion>
        <JsonLd
          data={changelogJsonLd(
            RELEASES.map((r) => ({
              version: r.version,
              title: r.title,
              lede: r.lede,
              url: r.url
            }))
          )}
        />
        <JsonLd
          data={breadcrumbJsonLd([
            { name: 'Linea', path: '/' },
            { name: 'Changelog', path: '/changelog' }
          ])}
        />
        <Nav />
        <main>
          <Changelog />
        </main>
      </ReducedMotion>
    </ThemeProvider>
  )
}
