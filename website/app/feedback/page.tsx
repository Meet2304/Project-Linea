import type { Metadata } from 'next'
import Nav from '@/components/Nav'
import Footer from '@/components/Footer'
import ThemeProvider from '@/components/theme/ThemeProvider'
import ReducedMotion from '@/components/motion/ReducedMotion'
import FeedbackScreen from '@/components/feedback/FeedbackScreen'

const TITLE = 'Feedback — Linea'
const DESCRIPTION = 'Report a problem or an idea. A sentence is enough — it becomes a GitHub issue.'

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
