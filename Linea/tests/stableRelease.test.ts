import { readFileSync } from 'node:fs'
import { describe, expect, it, vi } from 'vitest'
import { latestAssetUrl } from '../../website/lib/github'

describe('stable download routing', () => {
  it('keeps Mac on its last stable asset and excludes newer betas', async () => {
    const releases = [
      {
        tag_name: 'v0.3.0-beta.1',
        prerelease: true,
        published_at: '2026-09-09',
        assets: [{ name: 'beta.dmg', browser_download_url: 'beta' }]
      },
      {
        tag_name: 'v0.2.0',
        published_at: '2026-09-07',
        assets: [{ name: 'setup.exe', browser_download_url: 'windows-stable' }]
      },
      {
        tag_name: 'v0.1.6',
        published_at: '2026-07-29',
        assets: [{ name: 'legacy.dmg', browser_download_url: 'mac-legacy' }]
      }
    ]
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => ({ ok: true, json: async () => releases }))
    )
    try {
      expect(await latestAssetUrl('win')).toBe('windows-stable')
      expect(await latestAssetUrl('mac')).toBe('mac-legacy')
    } finally {
      vi.unstubAllGlobals()
    }
  })
  it('publishes only Windows and carries forward legacy Mac update metadata', () => {
    const workflow = readFileSync('../.github/workflows/release.yml', 'utf8')
    expect(workflow).not.toContain('"os":"macos-latest"')
    expect(workflow).toContain('.github/legacy-mac/latest-mac.yml')
    const manifest = readFileSync('../.github/legacy-mac/latest-mac.yml', 'utf8')
    expect(manifest).toContain('version: 0.1.6')
    expect(manifest).toContain('/v0.1.6/Linea-0.1.6.dmg')
  })
})
