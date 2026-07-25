import { EMPTY_RELEASE, REPO_NAME, REPO_OWNER, type ReleaseAsset, type ReleaseInfo } from './release'

/**
 * Server-only GitHub lookups. Kept out of lib/release.ts because that module
 * is imported by client components — the token must never reach the browser.
 */

const API_BASE = `https://api.github.com/repos/${REPO_OWNER}/${REPO_NAME}`

export const RELEASE_REVALIDATE_SECONDS = 600

function headers(): HeadersInit {
  const token = process.env.GITHUB_TOKEN
  return {
    Accept: 'application/vnd.github+json',
    'X-GitHub-Api-Version': '2022-11-28',
    ...(token ? { Authorization: `Bearer ${token}` } : {})
  }
}

interface GhAsset {
  name: string
  size: number
  browser_download_url: string
}

interface GhRelease {
  tag_name?: string
  published_at?: string
  assets?: GhAsset[]
}

/** Matches electron-builder.yml: nsis .exe for Windows, dmg for macOS. */
const EXTENSION: Record<'win' | 'mac', string> = { win: '.exe', mac: '.dmg' }

function pick(assets: GhAsset[], ext: string): ReleaseAsset | undefined {
  const hit = assets.find((a) => a.name.toLowerCase().endsWith(ext))
  return hit ? { url: hit.browser_download_url, size: hit.size, name: hit.name } : undefined
}

/**
 * `/releases/latest` already excludes drafts and pre-releases, so demoting a
 * bad build to pre-release on GitHub is enough to pull it from the site.
 *
 * `cache: 'no-store'` is for the download redirect, which must resolve the
 * current release at click time — a cached answer there is exactly the bug
 * that shipped v0.1.0's installer to visitors after v0.1.1 was out.
 */
export async function fetchLatestRelease(opts?: { fresh?: boolean }): Promise<GhRelease | null> {
  const cache: RequestInit & { next?: { revalidate: number } } = opts?.fresh
    ? { cache: 'no-store' }
    : { next: { revalidate: RELEASE_REVALIDATE_SECONDS } }

  try {
    const res = await fetch(`${API_BASE}/releases/latest`, { headers: headers(), ...cache })
    // 404 is the expected response until the first release is tagged.
    if (!res.ok) return null
    return (await res.json()) as GhRelease
  } catch {
    return null
  }
}

/** Download URL for the latest build on `platform`, or null if there isn't one. */
export async function latestAssetUrl(platform: 'win' | 'mac'): Promise<string | null> {
  const rel = await fetchLatestRelease({ fresh: true })
  return pick(rel?.assets ?? [], EXTENSION[platform])?.url ?? null
}

/** Repo stars/forks — decoration for the open-source card. */
async function fetchRepoStats(): Promise<{ stars?: number; forks?: number }> {
  try {
    const res = await fetch(API_BASE, {
      headers: headers(),
      next: { revalidate: RELEASE_REVALIDATE_SECONDS }
    })
    if (!res.ok) return {}
    const repo = (await res.json()) as { stargazers_count?: number; forks_count?: number }
    return { stars: repo.stargazers_count, forks: repo.forks_count }
  } catch {
    return {}
  }
}

/**
 * Everything the page needs about the current release. Never throws: with no
 * release published the button falls back to the Releases page on `tag: null`.
 * The two lookups are independent so one failing cannot blank the other.
 */
export async function getReleaseInfo(): Promise<ReleaseInfo> {
  const [stats, rel] = await Promise.all([fetchRepoStats(), fetchLatestRelease()])

  const info: ReleaseInfo = { ...EMPTY_RELEASE, assets: {}, ...stats }
  if (rel) {
    const assets = rel.assets ?? []
    info.tag = rel.tag_name ?? null
    info.publishedAt = rel.published_at
    info.assets = { win: pick(assets, EXTENSION.win), mac: pick(assets, EXTENSION.mac) }
  }
  return info
}
