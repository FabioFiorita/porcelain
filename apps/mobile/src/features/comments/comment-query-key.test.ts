import { reviewCommentsQuery } from '@porcelain/client-runtime/review'
import { describe, expect, it } from 'vitest'

import {
  isReviewCommentsQueryKey,
  reviewCommentsQueryKey,
  reviewCommentsQueryKeyForIdentity,
} from './comment-query-key'

const PROJECT = '/synthetic/repo'
const OTHER = '/synthetic/other'
const ENV = 'env-comments-test'
const OTHER_ENV = 'env-other'

describe('reviewCommentsQueryKey', () => {
  it('is the typed comments identity plus environment id', () => {
    const key = reviewCommentsQueryKey(ENV, PROJECT)
    expect(key).toEqual([
      'daemon',
      ENV,
      { domain: 'review', name: 'comments', projectPath: PROJECT },
    ])
    expect(key).toEqual(reviewCommentsQueryKeyForIdentity(ENV, reviewCommentsQuery(PROJECT)))
  })

  it('distinguishes Projects and environments', () => {
    const a = reviewCommentsQueryKey(ENV, PROJECT)
    const b = reviewCommentsQueryKey(ENV, OTHER)
    const c = reviewCommentsQueryKey(OTHER_ENV, PROJECT)
    expect(a[2]).not.toEqual(b[2])
    expect(a[1]).not.toEqual(c[1])
  })

  it('recognizes only comments identities in the predicate', () => {
    expect(isReviewCommentsQueryKey(reviewCommentsQueryKey(ENV, PROJECT))).toBe(true)
    expect(
      isReviewCommentsQueryKey([
        'daemon',
        ENV,
        { domain: 'board', name: 'cards', projectPath: PROJECT },
      ]),
    ).toBe(false)
    expect(
      isReviewCommentsQueryKey([
        'daemon',
        ENV,
        { domain: 'review', name: 'evidence', projectPath: PROJECT },
      ]),
    ).toBe(false)
    expect(isReviewCommentsQueryKey(['reviewComments'])).toBe(false)
    expect(isReviewCommentsQueryKey(['daemon', ENV])).toBe(false)
    expect(isReviewCommentsQueryKey([])).toBe(false)
  })
})
