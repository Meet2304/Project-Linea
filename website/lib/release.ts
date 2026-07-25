export const REPO_OWNER = 'Meet2304'
export const REPO_NAME = 'Project-Linea'
export const REPO_URL = `https://github.com/${REPO_OWNER}/${REPO_NAME}`
export const RELEASES_URL = `${REPO_URL}/releases`
export const LICENSE_URL = `${REPO_URL}/blob/main/LICENSE`
export const NOTICE_URL = `${REPO_URL}/blob/main/NOTICE.md`
export const ISSUES_URL = `${REPO_URL}/issues`

export interface ReleaseAsset {
  url: string
  size: number
  name: string
}

export interface ReleaseInfo {
  /** null when no release has been published yet, or the lookup failed. */
  tag: string | null
  publishedAt?: string
  stars?: number
  forks?: number
  assets: {
    win?: ReleaseAsset
    mac?: ReleaseAsset
  }
}

export const EMPTY_RELEASE: ReleaseInfo = { tag: null, assets: {} }

export function formatSize(bytes: number): string {
  const mb = bytes / 1024 / 1024
  return mb >= 1000 ? `${(mb / 1024).toFixed(1)} GB` : `${Math.round(mb)} MB`
}

export type Platform = 'win' | 'mac' | 'other'

/**
 * Best-effort OS detection. `userAgentData` where it exists, the deprecated
 * `platform` string otherwise. Linux and everything else fall through to
 * `other` — electron-builder.yml has no linux target, so we must not offer
 * a download we don't build.
 */
export function detectPlatform(): Platform {
  if (typeof navigator === 'undefined') return 'other'

  const uaData = (navigator as Navigator & { userAgentData?: { platform?: string } }).userAgentData
  const raw = (uaData?.platform || navigator.platform || navigator.userAgent || '').toLowerCase()

  if (raw.includes('win')) return 'win'
  if (raw.includes('mac') || raw.includes('darwin')) return 'mac'
  return 'other'
}

export const PLATFORM_LABEL: Record<Platform, string> = {
  win: 'Windows',
  mac: 'macOS',
  other: 'your platform'
}

/**
 * Link target for a download. Always the /download redirect rather than a
 * release asset URL: the asset URL names a specific version and gets frozen
 * into the cached HTML, so a stale page keeps serving a superseded installer.
 * The redirect resolves the latest release when the visitor clicks.
 */
export function downloadHref(platform: 'win' | 'mac'): string {
  return `/download?platform=${platform}`
}
