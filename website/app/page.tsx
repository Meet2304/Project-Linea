import Nav from '@/components/Nav'
import Showcase from '@/components/showcase/Showcase'
import UnderTheHood from '@/components/UnderTheHood'
import Cymatics from '@/components/Cymatics'
import OpenSource from '@/components/OpenSource'
import DownloadCTA from '@/components/DownloadCTA'
import Footer from '@/components/Footer'
import ThemeProvider from '@/components/theme/ThemeProvider'
import ReducedMotion from '@/components/motion/ReducedMotion'
import { getReleaseInfo } from '@/lib/github'

// Re-render at most every 10 minutes; release info is the only dynamic bit.
// Next requires a literal here, so this must stay in step with
// RELEASE_REVALIDATE_SECONDS in lib/github.ts.
//
// This only affects the version/size caption — the download button links at
// /download, which resolves the current release when the visitor clicks.
export const revalidate = 600

export default async function Page() {
  const release = await getReleaseInfo()

  return (
    <ThemeProvider>
      <ReducedMotion>
        <Nav />
        <main>
          {/* Hero and the feature walkthrough are one pinned sequence. */}
          <Showcase release={release} />
          <UnderTheHood />
          <Cymatics />
          <OpenSource release={release} />
          <DownloadCTA release={release} />
        </main>
        <Footer />
      </ReducedMotion>
    </ThemeProvider>
  )
}
