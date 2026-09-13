import type { Metadata } from 'next'
import Nav from '@/components/Nav'
import Footer from '@/components/Footer'
import ThemeProvider from '@/components/theme/ThemeProvider'
import ReducedMotion from '@/components/motion/ReducedMotion'
import FeedbackScreen from '@/components/feedback/FeedbackScreen'

const TITLE = 'Feedback — Linea'
const DESCRIPTION =
  'Report a problem with Linea. A short form that asks for Windows version, player, song and steps.'

export const metadata: Metadata = {
  title: TITLE,
  description: DESCRIPTION,
  openGraph: {
    type: 'website',
    title: TITLE,
    description: DESCRIPTION,
    siteName: 'Linea'
  },
  twitter: { card: 'summary_large_image', title: TITLE, description: DESCRIPTION }
}

export default function FeedbackPage() {
  return (
    <ThemeProvider>
      <ReducedMotion>
        <Nav />
        <main>
          <FeedbackScreen />
        </main>
        <Footer />
      </ReducedMotion>
    </ThemeProvider>
  )
}
