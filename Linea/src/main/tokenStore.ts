import { app, safeStorage } from 'electron'
import { join } from 'node:path'
import { readFileSync, writeFileSync, existsSync, unlinkSync } from 'node:fs'

const authFile = (): string => join(app.getPath('userData'), 'auth.dat')

/**
 * In-memory copy of the refresh token. `hasAuth()` is called on every
 * poll cycle — without this cache each call would be a synchronous disk
 * read plus an OS keychain/DPAPI decrypt. `undefined` = not loaded yet.
 */
let cached: string | null | undefined

export function saveRefreshToken(refreshToken: string): void {
  cached = refreshToken
  try {
    writeFileSync(authFile(), safeStorage.encryptString(refreshToken))
  } catch (error) {
    // The session still works from memory; only persistence failed.
    console.error('Failed to persist refresh token:', error)
  }
}

export function loadRefreshToken(): string | null {
  if (cached !== undefined) return cached
  try {
    cached = existsSync(authFile()) ? safeStorage.decryptString(readFileSync(authFile())) : null
  } catch (error) {
    // Corrupt file or keychain change — treat as logged out rather than
    // crashing the poll loop.
    console.error('Failed to read refresh token:', error)
    cached = null
  }
  return cached
}

export function clearRefreshToken(): void {
  cached = null
  try {
    if (existsSync(authFile())) unlinkSync(authFile())
  } catch (error) {
    console.error('Failed to delete refresh token file:', error)
  }
}
