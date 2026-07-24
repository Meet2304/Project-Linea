import { NextResponse } from 'next/server'
import {
  EMPTY_RELEASE,
  REPO_NAME,
  REPO_OWNER,
  type ReleaseAsset,
  type ReleaseInfo
} from '@/lib/release'

/**
 * Proxy for the GitHub API.
 *
 * Doing this server-side keeps any token out of the browser and means the
 * public rate limit is consumed once per revalidation window rather than once
 * per visitor. It must never throw: before the first release is published the
 * releases endpoint 404s, and the download button falls back to
 * "build from source" on `{ tag: null }`.
 */

const REVALIDATE_SECONDS = 600

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

function pick(assets: GhAsset[], test: (name: string) => boolean): ReleaseAsset | undefined {
  const hit = assets.find((a) => test(a.name.toLowerCase()))
  return hit ? { url: hit.browser_download_url, size: hit.size, name: hit.name } : undefined
}

export async function GET() {
  const base = `https://api.github.com/repos/${REPO_OWNER}/${REPO_NAME}`
  const info: ReleaseInfo = { ...EMPTY_RELEASE, assets: {} }

  // Repo metadata drives the open-source card. Independent of the release
  // lookup — one failing must not blank the other.
  try {
    const res = await fetch(base, {
      headers: headers(),
      next: { revalidate: REVALIDATE_SECONDS }
    })
    if (res.ok) {
      const repo = (await res.json()) as { stargazers_count?: number; forks_count?: number }
      info.stars = repo.stargazers_count
      info.forks = repo.forks_count
    }
  } catch {
    // Leave stars/forks undefined; the card renders without them.
  }

  try {
    const res = await fetch(`${base}/releases/latest`, {
      headers: headers(),
      next: { revalidate: REVALIDATE_SECONDS }
    })

    // 404 is the expected response until the first release is tagged.
    if (res.ok) {
      const rel = (await res.json()) as {
        tag_name?: string
        published_at?: string
        assets?: GhAsset[]
      }
      const assets = rel.assets ?? []
      info.tag = rel.tag_name ?? null
      info.publishedAt = rel.published_at
      // Matches electron-builder.yml: nsis .exe for Windows, dmg for macOS.
      info.assets = {
        win: pick(assets, (n) => n.endsWith('.exe')),
        mac: pick(assets, (n) => n.endsWith('.dmg'))
      }
    }
  } catch {
    // Network failure — fall through with tag: null.
  }

  return NextResponse.json(info, {
    headers: {
      'Cache-Control': `public, s-maxage=${REVALIDATE_SECONDS}, stale-while-revalidate=3600`
    }
  })
}
