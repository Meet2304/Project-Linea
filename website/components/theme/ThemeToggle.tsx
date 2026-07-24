'use client'

import { useId } from 'react'
import { useTheme } from './ThemeProvider'
import s from './theme-toggle.module.css'

/**
 * The app's own sun/moon toggle, ported from Linea/src/renderer/index.html
 * and its `.theme-toggle` rules in main.css. A clip path slides across to
 * bite a crescent out of the disc while the rays rotate away and shrink.
 *
 * Adapted from Skiper UI's ThemeToggleButton2, inspired by toggles.dev —
 * credited in NOTICE.md.
 */
export default function ThemeToggle({ small }: { small?: boolean }) {
  const { theme, toggle } = useTheme()
  const dark = theme === 'dark'
  // The clipPath id must be unique per instance or a second copy on the
  // page would reuse the first one's mask.
  const clipId = useId().replace(/:/g, '')

  return (
    <button
      type="button"
      role="switch"
      aria-checked={dark}
      aria-label={dark ? 'Switch to light theme' : 'Switch to dark theme'}
      className={small ? `${s.themeToggle} ${s.small}` : s.themeToggle}
      onClick={toggle}
    >
      <svg
        xmlns="http://www.w3.org/2000/svg"
        aria-hidden="true"
        fill="currentColor"
        strokeLinecap="round"
        viewBox="0 0 32 32"
      >
        <clipPath id={clipId}>
          <path className={s.mask} d="M0-5h30a1 1 0 0 0 9 13v24H0Z" />
        </clipPath>
        <g clipPath={`url(#${clipId})`}>
          <circle className={s.core} cx="16" cy="16" r="8" />
          <g className={s.rays} stroke="currentColor" strokeWidth="1.5" fill="none">
            <path d="M16 5.5v-4" />
            <path d="M16 30.5v-4" />
            <path d="M1.5 16h4" />
            <path d="M26.5 16h4" />
            <path d="m23.4 8.6 2.8-2.8" />
            <path d="m5.7 26.3 2.9-2.9" />
            <path d="m5.8 5.8 2.8 2.8" />
            <path d="m23.4 23.4 2.9 2.9" />
          </g>
        </g>
      </svg>
    </button>
  )
}
