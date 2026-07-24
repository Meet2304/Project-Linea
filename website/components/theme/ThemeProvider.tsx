'use client'

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'

type Theme = 'light' | 'dark'

const opposite = (t: Theme): Theme => (t === 'dark' ? 'light' : 'dark')

interface ThemeApi {
  /** What the page is actually wearing right now. */
  theme: Theme
  /** The visitor's own choice, ignoring any section inversion. */
  base: Theme
  /** Flip the visitor's choice. Also drops any active inversion. */
  toggle: () => void
  /**
   * Let a section temporarily invert the page. Whatever the visitor picked,
   * this shows them the other one — and hands it straight back when the
   * section scrolls away.
   */
  setInverted: (on: boolean) => void
}

const Ctx = createContext<ThemeApi | null>(null)

export function useTheme(): ThemeApi {
  const ctx = useContext(Ctx)
  if (!ctx) throw new Error('useTheme must be used inside <ThemeProvider>')
  return ctx
}

export default function ThemeProvider({ children }: { children: React.ReactNode }) {
  // `base` is the visitor's choice and persists. `inverted` is borrowed by
  // whichever section is on screen, so the light/dark feature can show the
  // other mode without permanently changing what the visitor picked.
  const [base, setBase] = useState<Theme>('light')
  const [inverted, setInvertedState] = useState(false)

  const theme: Theme = inverted ? opposite(base) : base

  useEffect(() => {
    const root = document.documentElement
    if (theme === 'dark') root.setAttribute('data-theme', 'dark')
    else root.removeAttribute('data-theme')
    // Keep the browser UI (form controls, scrollbars) in step.
    root.style.colorScheme = theme
  }, [theme])

  const toggle = useCallback(() => {
    // Flip what is on screen, and make that the visitor's choice. Dropping
    // the inversion at the same time means the button always does exactly
    // what it looks like it will do, even mid-section.
    setBase(opposite(theme))
    setInvertedState(false)
  }, [theme])

  const setInverted = useCallback((on: boolean) => setInvertedState(on), [])

  const value = useMemo(
    () => ({ theme, base, toggle, setInverted }),
    [theme, base, toggle, setInverted]
  )

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>
}
