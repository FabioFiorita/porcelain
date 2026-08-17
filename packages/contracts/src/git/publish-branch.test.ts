import { describe, expect, it } from 'vitest'
import { branchNeedsPublish, upstreamShortName } from './publish-branch'

describe('upstreamShortName', () => {
  it('strips the first remote segment', () => {
    expect(upstreamShortName('origin/main')).toBe('main')
    expect(upstreamShortName('origin/work/foo')).toBe('work/foo')
  })

  it('leaves a local tracking name alone', () => {
    expect(upstreamShortName('main')).toBe('main')
  })
})

describe('branchNeedsPublish', () => {
  it('is false for detached HEAD', () => {
    expect(branchNeedsPublish({ branch: null, upstream: null })).toBe(false)
  })

  it('is true when a named branch has no upstream', () => {
    expect(branchNeedsPublish({ branch: 'work/foo', upstream: null })).toBe(true)
  })

  it('is true when the upstream name does not match the branch', () => {
    expect(branchNeedsPublish({ branch: 'work/foo', upstream: 'origin/main' })).toBe(true)
    expect(branchNeedsPublish({ branch: 'work/foo', upstream: 'main' })).toBe(true)
  })

  it('is false when the upstream already is this branch on a remote', () => {
    expect(branchNeedsPublish({ branch: 'work/foo', upstream: 'origin/work/foo' })).toBe(false)
    expect(branchNeedsPublish({ branch: 'main', upstream: 'origin/main' })).toBe(false)
  })
})
