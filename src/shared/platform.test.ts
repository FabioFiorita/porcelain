import { afterEach, describe, expect, it, vi } from 'vitest'
import { resolvePlatform } from './platform'

// `process.platform` is read-only, so stub it per case with defineProperty and
// restore after. `PORCELAIN_FORCE_LINUX` is a plain env var we set/delete.
function withPlatform(value: NodeJS.Platform, run: () => void): void {
  const original = Object.getOwnPropertyDescriptor(process, 'platform')
  Object.defineProperty(process, 'platform', { value, configurable: true })
  try {
    run()
  } finally {
    if (original) Object.defineProperty(process, 'platform', original)
  }
}

describe('resolvePlatform', () => {
  afterEach(() => {
    vi.unstubAllEnvs()
  })

  it('maps macOS to darwin', () => {
    withPlatform('darwin', () => expect(resolvePlatform()).toBe('darwin'))
  })

  it('maps Windows to win32', () => {
    withPlatform('win32', () => expect(resolvePlatform()).toBe('win32'))
  })

  it('maps Linux to linux', () => {
    withPlatform('linux', () => expect(resolvePlatform()).toBe('linux'))
  })

  it('folds the other Unixes (e.g. freebsd) into the Linux path', () => {
    withPlatform('freebsd', () => expect(resolvePlatform()).toBe('linux'))
  })

  it('forces linux via PORCELAIN_FORCE_LINUX=1, overriding a real Mac', () => {
    vi.stubEnv('PORCELAIN_FORCE_LINUX', '1')
    withPlatform('darwin', () => expect(resolvePlatform()).toBe('linux'))
  })

  it('ignores PORCELAIN_FORCE_LINUX when it is not exactly "1"', () => {
    vi.stubEnv('PORCELAIN_FORCE_LINUX', '0')
    withPlatform('darwin', () => expect(resolvePlatform()).toBe('darwin'))
  })
})
