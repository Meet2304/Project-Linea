import { app, safeStorage } from 'electron'
import { join } from 'node:path'
import { readFileSync, writeFileSync, existsSync, unlinkSync } from 'node:fs'

const authFile = (): string => join(app.getPath('userData'), 'auth.dat')

export function saveRefreshToken(refreshToken: string): void {
  writeFileSync(authFile(), safeStorage.encryptString(refreshToken))
}

export function loadRefreshToken(): string | null {
  if (!existsSync(authFile())) return null
  return safeStorage.decryptString(readFileSync(authFile()))
}

export function clearRefreshToken(): void {
  if (existsSync(authFile())) unlinkSync(authFile())
}
