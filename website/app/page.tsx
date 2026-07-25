import Nav from '@/components/Nav'
import Showcase from '@/components/showcase/Showcase'
import UnderTheHood from '@/components/UnderTheHood'
import Cymatics from '@/components/Cymatics'
import OpenSource from '@/components/OpenSource'
import DownloadCTA from '@/components/DownloadCTA'
import Footer from '@/components/Footer'
import ThemeProvider from '@/components/theme/ThemeProvider'
import ReducedMotion from '@/components/motion/ReducedMotion'
import { EMPTY_RELEASE, REPO_NAME, REPO_OWNER, type ReleaseInfo } from '@/lib/release'

// Re-render at most every 10 minutes; release info is the only dynamic bit.
export const revalidate = 600

/**
 * Read the release straight from GitHub during the server render. The
 * /api/release route exists for the same data at runtime, but calling it
 * here would mean the page fetching itself.
 */
async function getRelease(): Promise<ReleaseInfo> {
  const base = `https://api.github.com/repos/${REPO_OWNER}/${REPO_NAME}`
  const token = process.env.GITHUB_TOKEN
  const headers: HeadersInit = {
    Accept: 'application/vnd.github+json',
    'X-GitHub-Api-Version': '2022-11-28',
    ...(token ? { Authorization: `Bearer ${token}` } : {})
  }

  const info: ReleaseInfo = { ...EMPTY_RELEASE, assets: {} }

  try {
    const repoRes = await fetch(base, { headers, next: { revalidate } })
    if (repoRes.ok) {
      const repo = (await repoRes.json()) as { stargazers_count?: number; forks_count?: number }
      info.stars = repo.stargazers_count
      info.forks = repo.forks_count
    }
  } catch {
    // Stats are decoration; the page renders fine without them.
  }

  try {
    const relRes = await fetch(`${base}/releases/latest`, { headers, next: { revalidate } })
    // 404 until the first release is tagged — expected, not an error.
    if (relRes.ok) {
      const rel = (await relRes.json()) as {
        tag_name?: string
        published_at?: string
        assets?: { name: string; size: number; browser_download_url: string }[]
      }
      const assets = rel.assets ?? []
      const find = (ext: string) => {
        const hit = assets.find((a) => a.name.toLowerCase().endsWith(ext))
        return hit ? { url: hit.browser_download_url, size: hit.size, name: hit.name } : undefined
      }
      info.tag = rel.tag_name ?? null
      info.publishedAt = rel.published_at
      info.assets = { win: find('.exe'), mac: find('.dmg') }
    }
  } catch {
    // Falls through with tag: null → "Build from source".
  }

  return info
}

export default async function Page() {
  const release = await getRelease()

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
