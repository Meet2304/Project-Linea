import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('electron', () => ({
  app: { getPath: () => '/tmp/linea-test' },
  safeStorage: {
    encryptString: (s: string) => Buffer.from(s, 'utf-8'),
    decryptString: (b: Buffer) => b.toString('utf-8')
  }
}))

vi.mock('node:fs', async (importOriginal) => {
  const actual = await importOriginal<typeof import('node:fs')>()
  const store = new Map<string, Buffer>()
  return {
    ...actual,
    existsSync: (p: string) => store.has(p),
    readFileSync: (p: string) => store.get(p)!,
    writeFileSync: (p: string, data: Buffer | string) => {
      store.set(p, Buffer.isBuffer(data) ? data : Buffer.from(data))
    },
    unlinkSync: (p: string) => {
      store.delete(p)
    }
  }
})

const { saveRefreshToken, loadRefreshToken, clearRefreshToken } =
  await import('../src/main/tokenStore')

describe('tokenStore', () => {
  beforeEach(() => {
    clearRefreshToken()
  })

  it('round-trips a refresh token', () => {
    saveRefreshToken('my-token')
    expect(loadRefreshToken()).toBe('my-token')
  })

  it('returns null before any token is saved', () => {
    expect(loadRefreshToken()).toBeNull()
  })
})
