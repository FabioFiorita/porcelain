import { describe, expect, it } from 'vitest'
import { reviewMutations } from './review-mutations'
import { reviewedPathsQuery } from './review-queries'

describe('setReviewed query effects', () => {
  it('targets the exact branch comparison and preserves the legacy working identity', () => {
    expect(
      reviewMutations.setReviewed.affectedQueries({
        repoPath: '/repo',
        paths: ['a.ts'],
        reviewed: true,
        scope: { type: 'branch', base: 'develop' },
      }),
    ).toEqual([reviewedPathsQuery('/repo', { type: 'branch', base: 'develop' })])
    expect(
      reviewMutations.setReviewed.affectedQueries({
        repoPath: '/repo',
        paths: ['a.ts'],
        reviewed: true,
      }),
    ).toEqual([reviewedPathsQuery('/repo')])
  })
})
