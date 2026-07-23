import { app } from 'electron'
import { join } from 'node:path'
import { readFileSync, writeFileSync, existsSync } from 'node:fs'
import type { LyricsSize, Prefs, Theme } from '../shared/types'

const prefsFile = (): string => join(app.getPath('userData'), 'prefs.json')

const DEFAULT_PREFS: Prefs = {
  opacity: 0.95,
  lyricsSize: 'medium',
  theme: 'light',
  pinned: true,
  lyricsExpanded: true,
  showTimestamps: false
}

function clampTheme(value: unknown): Theme {
  return value === 'dark' ? 'dark' : 'light'
}

function clampLyricsSize(value: unknown): LyricsSize {
  return value === 'small' || value === 'large' ? value : 'medium'
}

function clampBoolean(value: unknown, fallback: boolean): boolean {
  return typeof value === 'boolean' ? value : fallback
}

/**
 * Also migrates older prefs.json files: missing fields get defaults, the
 * opacity floor is 0.6 (panel alpha below that is illegible), and a legacy
 * numeric `fontSize` is dropped in favor of the lyricsSize preset.
 */
export function clampPrefs(input: Partial<Prefs>): Prefs {
  return {
    opacity: Math.min(1, Math.max(0.6, input.opacity ?? DEFAULT_PREFS.opacity)),
    lyricsSize: clampLyricsSize(input.lyricsSize),
    theme: clampTheme(input.theme),
    pinned: clampBoolean(input.pinned, DEFAULT_PREFS.pinned),
    lyricsExpanded: clampBoolean(input.lyricsExpanded, DEFAULT_PREFS.lyricsExpanded),
    showTimestamps: clampBoolean(input.showTimestamps, DEFAULT_PREFS.showTimestamps)
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
