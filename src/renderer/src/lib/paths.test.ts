import { describe, expect, it } from 'vitest'
import { dirName, fileName, relativeTo } from './paths'

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

describe('fileName', () => {
  it('returns the last segment of a nested path', () => {
    expect(fileName('a/b/c.ts')).toBe('c.ts')
  })

  it('returns the input when there is no slash', () => {
    expect(fileName('index.ts')).toBe('index.ts')
  })

  it('returns the last segment of an absolute path', () => {
    expect(fileName('/Users/foo/bar/baz.ts')).toBe('baz.ts')
  })

  it('returns an empty string for a trailing-slash path', () => {
    expect(fileName('a/b/')).toBe('')
  })
})

describe('dirName', () => {
  it('returns everything before the last slash for a nested path', () => {
    expect(dirName('a/b/c.ts')).toBe('a/b')
  })

  it('returns an empty string when there is no slash', () => {
    expect(dirName('index.ts')).toBe('')
  })

  it('returns the parent for an absolute path', () => {
    expect(dirName('/Users/foo/bar/baz.ts')).toBe('/Users/foo/bar')
  })

  it('returns everything before the trailing slash for a trailing-slash path', () => {
    expect(dirName('a/b/')).toBe('a/b')
  })
})
