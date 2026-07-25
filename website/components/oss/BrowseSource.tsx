'use client'

import Icon from '../ui/Icon'
import { AnimateIcon } from '@/components/animate-ui/icons/icon'
import { SquareArrowOutUpRightIcon } from '@/components/animate-ui/icons/square-arrow-out-up-right'

/**
 * The repo link, with the corner arrow that leaves through the corner it
 * points at when the button is hovered.
 *
 * A client component for one specific reason: Animate UI's `asChild` reads
 * the element type off its child to build a motion component from it, and an
 * element that crossed the server → client boundary arrives as a lazy node
 * with no readable type. The button has to be created on the client for the
 * hover wiring to attach to it — so the boundary sits here, on the one
 * interactive thing, rather than on the whole section.
 */
export default function BrowseSource({ href }: { href: string }) {
  return (
    // asChild hands the hover to the anchor, so the arrow answers the whole
    // button rather than its own 15px.
    <AnimateIcon animateOnHover asChild>
      <a
        href={href}
        target="_blank"
        rel="noreferrer noopener"
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 8,
          padding: '11px 22px',
          borderRadius: 'var(--radius-round)',
          background: 'var(--ink)',
          color: 'var(--surface-page)',
          fontSize: 'var(--text-sm)',
          fontWeight: 500,
          textDecoration: 'none'
        }}
      >
        <Icon name="github" size={16} />
        Browse the source
        <SquareArrowOutUpRightIcon size={15} strokeWidth={1.75} aria-hidden="true" />
      </a>
    </AnimateIcon>
  )
}
