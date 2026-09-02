import { describe, expect, it } from 'vitest'
import { updaterUnavailableReason } from './updater-availability'

describe('updater availability', () => {
  it('explains that a development shell cannot self-update', () => {
    expect(updaterUnavailableReason(false, 'darwin', undefined)).toBe(
      'Automatic updates are available in the installed Porcelain app.',
    )
  })

  it('routes non-AppImage Linux installs to their package manager', () => {
    expect(updaterUnavailableReason(true, 'linux', undefined)).toContain('package manager')
  })

  it.each([
    ['darwin', undefined],
    ['win32', undefined],
    ['linux', '/tmp/Porcelain.AppImage'],
  ] as const)('allows the packaged updater on %s', (platform, appImage) => {
    expect(updaterUnavailableReason(true, platform, appImage)).toBeNull()
  })
})
