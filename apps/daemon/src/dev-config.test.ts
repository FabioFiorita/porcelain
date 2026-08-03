import { describe, expect, it } from 'vitest'
import { devRepoPath } from './dev-config'

describe('devRepoPath', () => {
  it('keeps the primary development playground by default', () => {
    expect(devRepoPath({}, '/home/test')).toBe('/home/test/code/porcelain-playground')
  })

  it('uses the managed worktree playground when provided', () => {
    expect(
      devRepoPath(
        { PORCELAIN_DEV_PLAYGROUND: '/home/test/code/porcelain-playgrounds/fix-review' },
        '/home/test',
      ),
    ).toBe('/home/test/code/porcelain-playgrounds/fix-review')
  })
})
