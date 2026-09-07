export function updatePolicy(
  version: string,
  platform: string
): {
  enabled: boolean
  channel: 'beta' | 'latest'
  allowPrerelease: boolean
  allowDowngrade: false
} {
  const beta = /-beta\.\d+$/.test(version)
  return {
    enabled: !beta || platform === 'win32' || platform === 'darwin',
    channel: beta ? 'beta' : 'latest',
    allowPrerelease: beta && (platform === 'win32' || platform === 'darwin'),
    allowDowngrade: false
  }
}
