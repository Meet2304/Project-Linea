import { app } from 'electron'
import { join } from 'node:path'
import { readFileSync, writeFileSync, existsSync } from 'node:fs'
import type { Prefs } from '../shared/types'

const prefsFile = (): string => join(app.getPath('userData'), 'prefs.json')
const DEFAULT_PREFS: Prefs = { opacity: 0.9, fontSize: 16 }

export function clampPrefs(input: Partial<Prefs>): Prefs {
  return {
    opacity: Math.min(1, Math.max(0.2, input.opacity ?? DEFAULT_PREFS.opacity)),
    fontSize: Math.min(28, Math.max(12, input.fontSize ?? DEFAULT_PREFS.fontSize))
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
