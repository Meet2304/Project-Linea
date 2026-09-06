import { describe, it, expect, vi } from 'vitest'
import type { RequestOptions } from 'node:http'
import { NsisUpdater } from 'electron-updater/out/NsisUpdater'
import { GitHubProvider } from 'electron-updater/out/providers/GitHubProvider'
import type { ProviderRuntimeOptions } from 'electron-updater/out/providers/Provider'
import type { AppAdapter } from 'electron-updater/out/AppAdapter'
import { updatePolicy } from '../src/shared/updatePolicy'

function updater(version: string, migrated: boolean): NsisUpdater {
  const app: AppAdapter = {
    version,
    name: 'linea',
    isPackaged: true,
    appUpdateConfigPath: '',
    userDataPath: '',
    baseCachePath: '',
    whenReady: async () => {},
    relaunch: () => {},
    quit: () => {},
    onQuit: () => {}
  }
  const instance = new NsisUpdater(null, app)
  if (migrated) {
    const policy = updatePolicy(version, 'win32')
    instance.channel = policy.channel
    instance.allowPrerelease = policy.allowPrerelease
    instance.allowDowngrade = policy.allowDowngrade
  }
  return instance
}

describe('installed updater against a simulated GitHub release feed', () => {
  for (const [version, migrated, selected, manifest] of [
    ['0.1.6', false, '0.1.7', 'latest.yml'],
    ['0.1.6', true, '0.1.7', 'latest.yml'],
    ['0.2.0-beta.1', true, '0.2.0-beta.2', 'beta.yml']
  ] as const) {
    it(version + (migrated ? ' migrated' : ' legacy') + ' selects the correct feed', async () => {
      const request = vi.fn(async (options: RequestOptions): Promise<string> => {
        const path = String(options.path)
        if (path.endsWith('.atom'))
          return (
            '<feed>' +
            ['0.2.0-beta.2', '0.1.7']
              .map(
                (tag) =>
                  '<entry><title>' +
                  tag +
                  '</title><link href="https://github.com/owner/repo/releases/tag/v' +
                  tag +
                  '"/><content>Test release</content></entry>'
              )
              .join('') +
            '</feed>'
          )
        if (path.endsWith('/latest')) return '{"tag_name":"v0.1.7"}'
        if (path.endsWith('/' + manifest))
          return JSON.stringify({
            version: selected,
            files: [{ url: 'setup.exe', sha512: 'fixture', size: 1 }]
          })
        throw new Error('Unexpected request: ' + path)
      })
      const provider = new GitHubProvider(
        { provider: 'github', owner: 'owner', repo: 'repo' },
        updater(version, migrated),
        {
          platform: 'win32',
          isUseMultipleRangeRequest: false,
          executor: { request } as unknown as ProviderRuntimeOptions['executor']
        }
      )
      expect((await provider.getLatestVersion()).version).toBe(selected)
      expect(request.mock.calls.at(-1)?.[0].path).toContain('/v' + selected + '/' + manifest)
      if (!version.includes('beta'))
        expect(request.mock.calls.some(([r]) => String(r.path).includes('beta.yml'))).toBe(false)
    })
  }
  it('accepts a newer beta and rejects older beta and stable versions', async () => {
    const instance = updater('0.2.0-beta.2', true) as unknown as {
      isUpdateAvailable(info: { version: string; files: unknown[] }): Promise<boolean>
    }
    expect(await instance.isUpdateAvailable({ version: '0.2.0-beta.3', files: [] })).toBe(true)
    expect(await instance.isUpdateAvailable({ version: '0.2.0-beta.1', files: [] })).toBe(false)
    expect(await instance.isUpdateAvailable({ version: '0.1.7', files: [] })).toBe(false)
  })
})
