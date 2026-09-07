'use client'

import { useEffect, useState } from 'react'
import { AnimateIcon } from '@/components/animate-ui/icons/icon'
import { DownloadIcon } from '@/components/animate-ui/icons/download'
import {
  detectPlatform,
  downloadHref,
  PLATFORM_LABEL,
  RELEASES_URL,
  type Platform
} from '@/lib/release'

interface Props {
  size?: 'md' | 'lg'
  /** Accent for the filled button. Defaults to ink. */
  accent?: string
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
 *
 * Nothing renders beneath the pill. The version, the installer size, the
 * other platform's link and the beta's caveats all used to sit here, and a
 * stack of small print under the one thing we want clicked reads as an
 * apology for it. What the button hands over is decided by /download, which
 * resolves the newest stable release for each platform at click time.
 */
export default function DownloadButton({ size = 'lg', accent = 'var(--ink)', className }: Props) {
  const [platform, setPlatform] = useState<Platform | null>(null)
  useEffect(() => setPlatform(detectPlatform()), [])

  // Never link at a release asset URL — that pins the version this page was
  // rendered with. The redirect resolves the current release at click time.
  const href = platform === 'win' || platform === 'mac' ? downloadHref(platform) : RELEASES_URL
  const label =
    platform === 'win' || platform === 'mac'
      ? platform === 'mac'
        ? 'Legacy Mac download'
        : `Download for ${PLATFORM_LABEL[platform]}`
      : 'Download Linea'

  const pad = size === 'lg' ? '15px 28px' : '11px 21px'
  const fontSize = size === 'lg' ? 'var(--text-base)' : 'var(--text-sm)'
  // Theme-aware ink fills need the on-accent token (white↔near-black).
  // Fixed jewel / hex accents stay dark enough that white label works.
  const labelColor = accent === 'var(--ink)' ? 'var(--text-on-accent)' : '#ffffff'

  return (
    // The wrapper stays so callers keep a layout hook around the pill —
    // showcase.module.css stretches `.heroDownload > a` on a phone.
    <div className={className} style={{ display: 'inline-flex', alignItems: 'flex-start' }}>
      {/* asChild puts the hover on the pill itself, so the whole button
          drives the arrow rather than the 18px glyph inside it. */}
      <AnimateIcon animateOnHover animation="default-loop" asChild>
        <a
          className="dl-primary"
          href={href}
          {...(platform === 'win' || platform === 'mac'
            ? {}
            : { target: '_blank', rel: 'noreferrer noopener' })}
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
          <DownloadIcon size={size === 'lg' ? 18 : 16} strokeWidth={1.75} aria-hidden="true" />
          {label}
        </a>
      </AnimateIcon>

      <style>{`
        .dl-primary:hover { transform: translateY(-1px); box-shadow: var(--shadow-lg); }
        .dl-primary:active { transform: translateY(0); }
      `}</style>
    </div>
  )
}
