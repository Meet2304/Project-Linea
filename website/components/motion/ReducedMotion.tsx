'use client'

import { MotionConfig } from 'motion/react'

/**
 * Motion ships as `reducedMotion: 'never'` — its animations run even for a
 * visitor whose OS has asked for less movement. Everything else on this page
 * honours that ask: the fields render a single still frame, and the global
 * rule in globals.css collapses every transition and CSS animation. Without
 * this the two Animate UI icons would be the only things on the page still
 * moving, which is measurable — they were.
 *
 * `user` defers to the preference: motion drops transform animations, and
 * both of those icons animate by travelling, so under the preference they
 * simply hold still.
 */
export default function ReducedMotion({ children }: { children: React.ReactNode }) {
  return <MotionConfig reducedMotion="user">{children}</MotionConfig>
}
