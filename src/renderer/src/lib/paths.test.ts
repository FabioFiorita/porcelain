import { describe, expect, it } from 'vitest'
import { relativeTo } from './paths'

describe('relativeTo', () => {
  it('strips the repo prefix from a nested path', () => {
    expect(relativeTo('/repo', '/repo/src/index.ts')).toBe('src/index.ts')
  })

  it('returns the path unchanged when it is not under the repo', () => {
    expect(relativeTo('/repo', '/other/src/index.ts')).toBe('/other/src/index.ts')
  })

  it('returns the path unchanged when the repo is undefined', () => {
    expect(relativeTo(undefined, '/repo/src/index.ts')).toBe('/repo/src/index.ts')
  })

  it('does not treat the repo path itself as a prefixed child', () => {
    expect(relativeTo('/repo', '/repo')).toBe('/repo')
  })
})
