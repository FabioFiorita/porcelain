import { describe, expect, it } from 'vitest'
import { isDevelopmentProfile } from './development-profile'

describe('isDevelopmentProfile', () => {
  it('recognizes Electron development and explicit packaged proof profiles', () => {
    expect(isDevelopmentProfile(true, undefined)).toBe(true)
    expect(isDevelopmentProfile(false, '1')).toBe(true)
  })

  it('keeps ordinary packaged launches in the installed-app profile', () => {
    expect(isDevelopmentProfile(false, undefined)).toBe(false)
    expect(isDevelopmentProfile(false, '')).toBe(false)
  })
})
