import type { Metadata } from 'next'
import Nav from '@/components/Nav'
import Changelog from '@/components/changelog/Changelog'
import ThemeProvider from '@/components/theme/ThemeProvider'
import ReducedMotion from '@/components/motion/ReducedMotion'

const TITLE = 'Changelog — Linea'
const DESCRIPTION =
  'Every Linea release, written the night it shipped — with whatever was playing at the time.'

export const metadata: Metadata = {
  title: TITLE,
  description: DESCRIPTION,
  openGraph: {
    type: 'article',
    title: TITLE,
    description: DESCRIPTION,
    siteName: 'Linea'
  },
  twitter: { card: 'summary_large_image', title: TITLE, description: DESCRIPTION }
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
        <Nav />
        <main>
          <Changelog />
        </main>
      </ReducedMotion>
    </ThemeProvider>
  )
}
