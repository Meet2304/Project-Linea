import { app } from 'electron'
import { join } from 'node:path'
import { readFileSync, writeFileSync, existsSync } from 'node:fs'
import type { Prefs, Theme } from '../shared/types'

const prefsFile = (): string => join(app.getPath('userData'), 'prefs.json')

const DEFAULT_PREFS: Prefs = {
  opacity: 0.92,
  fontSize: 14,
  theme: 'light',
  pinned: true,
  lyricsExpanded: true
}

function clampTheme(value: unknown): Theme {
  return value === 'dark' ? 'dark' : 'light'
}

function clampBoolean(value: unknown, fallback: boolean): boolean {
  return typeof value === 'boolean' ? value : fallback
}

/**
 * Also migrates old prefs.json files ({opacity, fontSize} only):
 * missing fields get defaults, and the opacity floor rose from 0.2
 * to 0.6 — panel alpha below that is illegible.
 */
export function clampPrefs(input: Partial<Prefs>): Prefs {
  return {
    opacity: Math.min(1, Math.max(0.6, input.opacity ?? DEFAULT_PREFS.opacity)),
    fontSize: Math.min(28, Math.max(12, input.fontSize ?? DEFAULT_PREFS.fontSize)),
    theme: clampTheme(input.theme),
    pinned: clampBoolean(input.pinned, DEFAULT_PREFS.pinned),
    lyricsExpanded: clampBoolean(input.lyricsExpanded, DEFAULT_PREFS.lyricsExpanded)
  }
}

export function loadPrefs(): Prefs {
  if (!existsSync(prefsFile())) return DEFAULT_PREFS
  try {
    return clampPrefs(JSON.parse(readFileSync(prefsFile(), 'utf-8')) as Partial<Prefs>)
  } catch {
    return DEFAULT_PREFS
  }
}

export function savePrefs(partial: Partial<Prefs>): Prefs {
  const next = clampPrefs({ ...loadPrefs(), ...partial })
  writeFileSync(prefsFile(), JSON.stringify(next))
  return next
}
