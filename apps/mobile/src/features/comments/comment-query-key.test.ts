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

  it('recognizes only the exact mobile three-tuple comments identity', () => {
    expect(isReviewCommentsQueryKey(reviewCommentsQueryKey(ENV, PROJECT))).toBe(true)

    // Wrong domain / name
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

    // Missing / non-string projectPath
    expect(isReviewCommentsQueryKey(['daemon', ENV, { domain: 'review', name: 'comments' }])).toBe(
      false,
    )
    expect(
      isReviewCommentsQueryKey([
        'daemon',
        ENV,
        { domain: 'review', name: 'comments', projectPath: 12 },
      ]),
    ).toBe(false)
    expect(
      isReviewCommentsQueryKey([
        'daemon',
        ENV,
        { domain: 'review', name: 'comments', projectPath: null },
      ]),
    ).toBe(false)

    // Extra tuple elements
    expect(
      isReviewCommentsQueryKey([
        'daemon',
        ENV,
        { domain: 'review', name: 'comments', projectPath: PROJECT },
        'extra',
      ]),
    ).toBe(false)

    // Web-shaped / head-identity keys (identity first, no daemon prefix)
    expect(
      isReviewCommentsQueryKey([
        { domain: 'review', name: 'comments', projectPath: PROJECT },
        { host: null, version: null },
      ]),
    ).toBe(false)
    expect(
      isReviewCommentsQueryKey([{ domain: 'review', name: 'comments', projectPath: PROJECT }]),
    ).toBe(false)

    // Truncated / wrong head
    expect(isReviewCommentsQueryKey(['reviewComments'])).toBe(false)
    expect(isReviewCommentsQueryKey(['daemon', ENV])).toBe(false)
    expect(isReviewCommentsQueryKey([])).toBe(false)
    expect(isReviewCommentsQueryKey(['daemon', 42, reviewCommentsQuery(PROJECT)])).toBe(false)
  })
})
