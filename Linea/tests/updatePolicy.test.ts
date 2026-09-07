import { describe, it, expect } from 'vitest'
import { updatePolicy } from '../src/shared/updatePolicy'
describe('release channels', () => {
  it('keeps stable Windows and macOS on stable releases', () => {
    for (const platform of ['win32', 'darwin'])
      expect(updatePolicy('0.1.6', platform)).toEqual({
        enabled: true,
        channel: 'latest',
        allowPrerelease: false,
        allowDowngrade: false
      })
  })
  it('opts Windows beta users into beta updates without downgrades', () => {
    expect(updatePolicy('0.2.0-beta.1', 'win32')).toEqual({
      enabled: true,
      channel: 'beta',
      allowPrerelease: true,
      allowDowngrade: false
    })
  })
  it('offers Mac beta updates through the beta feed', () => {
    expect(updatePolicy('0.2.0-beta.1', 'darwin')).toEqual({
      enabled: true,
      channel: 'beta',
      allowPrerelease: true,
      allowDowngrade: false
    })
  })
})
