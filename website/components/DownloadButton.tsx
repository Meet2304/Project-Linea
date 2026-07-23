'use client'

import { useEffect, useState } from 'react'
import Icon from './ui/Icon'
import Mono from './ui/Mono'
import {
  detectPlatform,
  formatSize,
  PLATFORM_LABEL,
  REPO_URL,
  type Platform,
  type ReleaseInfo
} from '@/lib/release'

interface Props {
  release: ReleaseInfo
  size?: 'md' | 'lg'
  /** Accent for the filled button. Defaults to ink. */
  accent?: string
  /** Show the version / size / other-platform line beneath. */
  showMeta?: boolean
}

/**
 * Resolves the right installer for the visitor.
 *
 * Platform detection has to happen on the client, so the first paint shows
 * the neutral "Download" label and it specialises on mount — that avoids a
 * hydration mismatch and still reads correctly with JS disabled.
 */
export default function DownloadButton({
  release,
  size = 'lg',
  accent = 'var(--ink)',
  showMeta = true
}: Props) {
  const [platform, setPlatform] = useState<Platform | null>(null)
  useEffect(() => setPlatform(detectPlatform()), [])

  const hasRelease = release.tag !== null
  const primaryAsset =
    platform === 'win' ? release.assets.win : platform === 'mac' ? release.assets.mac : undefined
  const otherKey = platform === 'win' ? 'mac' : 'win'
  const otherAsset = release.assets[otherKey]

  // No release yet, or we don't build for this OS: send people to the source
  // rather than to a dead link.
  const buildFromSource = !hasRelease || !primaryAsset

  const href = buildFromSource ? REPO_URL : primaryAsset!.url
  const label = buildFromSource
    ? 'Build from source'
    : platform
      ? `Download for ${PLATFORM_LABEL[platform]}`
      : 'Download'

  const pad = size === 'lg' ? '14px 26px' : '10px 20px'
  const fontSize = size === 'lg' ? 'var(--text-base)' : 'var(--text-sm)'

  return (
    <div style={{ display: 'inline-flex', flexDirection: 'column', alignItems: 'flex-start', gap: 10 }}>
      <a
        href={href}
        {...(buildFromSource ? { target: '_blank', rel: 'noreferrer noopener' } : {})}
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 10,
          padding: pad,
          borderRadius: 'var(--radius-round)',
          background: accent,
          color: 'var(--white)',
          fontSize,
          fontWeight: 500,
          letterSpacing: '-0.01em',
          textDecoration: 'none',
          boxShadow: 'var(--shadow-sm)',
          transition: 'background 220ms var(--ease), transform 120ms var(--ease)'
        }}
      >
        <Icon name={buildFromSource ? 'terminal' : 'download'} size={size === 'lg' ? 18 : 16} />
        {label}
      </a>

      {showMeta && (
        <Mono style={{ paddingLeft: 4 }}>
          {buildFromSource ? (
            <>Windows &amp; macOS builds coming</>
          ) : (
            <>
              {release.tag} · {formatSize(primaryAsset!.size)}
              {otherAsset && (
                <>
                  {' · '}
                  <a
                    href={otherAsset.url}
                    style={{ color: 'var(--steel)', textDecoration: 'underline' }}
                  >
                    also for {PLATFORM_LABEL[otherKey]}
                  </a>
                </>
              )}
            </>
          )}
        </Mono>
      )}
    </div>
  )
}
