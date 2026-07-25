'use client'

import { useEffect, useState } from 'react'
import Icon from './ui/Icon'
import Mono from './ui/Mono'
import {
  detectPlatform,
  formatSize,
  PLATFORM_LABEL,
  RELEASES_URL,
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
  /** Hook for the caller's own layout — the hero stretches it on a phone. */
  className?: string
}

/**
 * Resolves the right installer for the visitor.
 *
 * Platform detection has to happen on the client, so the first paint shows
 * the neutral "Download" label and it specialises on mount — that avoids a
 * hydration mismatch and still reads correctly with JS disabled.
 *
 * Until a release is tagged there is no asset to point at, so the button
 * falls back to the Releases page rather than a 404. It stays labelled
 * "Download": this is the one call to action on the page and swapping it for
 * something else undersells the product.
 */
export default function DownloadButton({
  release,
  size = 'lg',
  accent = 'var(--ink)',
  showMeta = true,
  className
}: Props) {
  const [platform, setPlatform] = useState<Platform | null>(null)
  useEffect(() => setPlatform(detectPlatform()), [])

  const primaryAsset =
    platform === 'win' ? release.assets.win : platform === 'mac' ? release.assets.mac : undefined
  const otherKey = platform === 'win' ? 'mac' : 'win'
  const otherAsset = release.assets[otherKey]

  const href = primaryAsset?.url ?? RELEASES_URL
  const label =
    platform === 'win' || platform === 'mac'
      ? `Download for ${PLATFORM_LABEL[platform]}`
      : 'Download Linea'

  const pad = size === 'lg' ? '15px 28px' : '11px 21px'
  const fontSize = size === 'lg' ? 'var(--text-base)' : 'var(--text-sm)'
  // Theme-aware ink fills need the on-accent token (white↔near-black).
  // Fixed jewel / hex accents stay dark enough that white label works.
  const labelColor = accent === 'var(--ink)' ? 'var(--text-on-accent)' : '#ffffff'

  return (
    <div
      className={className}
      style={{ display: 'inline-flex', flexDirection: 'column', alignItems: 'flex-start', gap: 10 }}
    >
      <a
        className="dl-primary"
        href={href}
        {...(primaryAsset ? {} : { target: '_blank', rel: 'noreferrer noopener' })}
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 10,
          padding: pad,
          borderRadius: 'var(--radius-round)',
          background: accent,
          color: labelColor,
          fontSize,
          fontWeight: 500,
          letterSpacing: '-0.01em',
          textDecoration: 'none',
          boxShadow: 'var(--shadow-md)',
          // Fill and label follow the theme, so they ease on the same clocks
          // the page uses for its surfaces and its type (700 / 420ms) rather
          // than snapping while everything around them crossfades. Transform
          // and shadow stay quick — those belong to the pointer, not the
          // theme.
          transition:
            'transform 160ms var(--ease), box-shadow 220ms var(--ease), background 700ms var(--ease), color 420ms var(--ease)'
        }}
      >
        <Icon name="download" size={size === 'lg' ? 18 : 16} />
        {label}
      </a>

      {/* Only render the meta line when it actually says something. With no
          release there is no version or size to report, and a placeholder
          there just reads as an apology under the main CTA. */}
      {showMeta && primaryAsset && (
        <Mono style={{ paddingLeft: 4 }}>
          {release.tag} · {formatSize(primaryAsset.size)}
          {otherAsset && (
            <>
              {' · '}
              <a href={otherAsset.url} style={{ color: 'var(--steel)', textDecoration: 'underline' }}>
                also for {PLATFORM_LABEL[otherKey]}
              </a>
            </>
          )}
        </Mono>
      )}

      <style>{`
        .dl-primary:hover { transform: translateY(-1px); box-shadow: var(--shadow-lg); }
        .dl-primary:active { transform: translateY(0); }
      `}</style>
    </div>
  )
}
