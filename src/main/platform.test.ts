import { describe, expect, it } from 'vitest'
import { resolvePlatform } from './platform'

describe('resolvePlatform', () => {
  it('maps darwin to darwin', () => {
    expect(resolvePlatform('darwin', false)).toBe('darwin')
  })

  it('maps win32 to win32', () => {
    expect(resolvePlatform('win32', false)).toBe('win32')
  })

  it('maps linux to linux', () => {
    expect(resolvePlatform('linux', false)).toBe('linux')
  })

  it('maps an unknown platform to linux', () => {
    expect(resolvePlatform('freebsd', false)).toBe('linux')
  })

  it('forces linux even on darwin when forceLinux is set', () => {
    expect(resolvePlatform('darwin', true)).toBe('linux')
  })
})
