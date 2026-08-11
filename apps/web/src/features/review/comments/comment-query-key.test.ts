import { reviewCommentsQuery } from '@porcelain/client-runtime/review'
import { describe, expect, it } from 'vitest'
import {
  isReviewCommentsQueryKey,
  reviewCommentsKeyForProject,
  reviewCommentsQueryKey,
} from './comment-query-key'

const PROJECT = '/synthetic/repo'
const OTHER = '/synthetic/other'
const DAEMON = { host: 'beelink', version: '0.52.1' }
const OTHER_DAEMON = { host: 'other-host', version: '0.52.1' }

describe('reviewCommentsQueryKey', () => {
  it('is the typed comments identity plus daemon scope', () => {
    const key = reviewCommentsKeyForProject(DAEMON, PROJECT)
    expect(key).toEqual([
      { domain: 'review', name: 'comments', projectPath: PROJECT },
      { host: 'beelink', version: '0.52.1' },
    ])
    expect(key).toEqual(reviewCommentsQueryKey(DAEMON, reviewCommentsQuery(PROJECT)))
  })

  it('distinguishes Projects and daemons', () => {
    const a = reviewCommentsKeyForProject(DAEMON, PROJECT)
    const b = reviewCommentsKeyForProject(DAEMON, OTHER)
    const c = reviewCommentsKeyForProject(OTHER_DAEMON, PROJECT)
    expect(a[0]).not.toEqual(b[0])
    expect(a[1]).not.toEqual(c[1])
  })

  it('recognizes only comments identities in the predicate', () => {
    expect(isReviewCommentsQueryKey(reviewCommentsKeyForProject(DAEMON, PROJECT))).toBe(true)
    expect(
      isReviewCommentsQueryKey([{ domain: 'board', name: 'cards', projectPath: PROJECT }]),
    ).toBe(false)
    expect(
      isReviewCommentsQueryKey([{ domain: 'review', name: 'evidence', projectPath: PROJECT }]),
    ).toBe(false)
    expect(isReviewCommentsQueryKey(['reviewComments'])).toBe(false)
    expect(isReviewCommentsQueryKey([])).toBe(false)
  })
})

describe('comments key parsing', () => {
  const IDENTITY = reviewCommentsQuery(PROJECT)

  it('rejects a malformed daemon scope', () => {
    expect(isReviewCommentsQueryKey([IDENTITY, { host: 'beelink' }])).toBe(false)
    expect(isReviewCommentsQueryKey([IDENTITY, { host: null, version: 2 }])).toBe(false)
    expect(isReviewCommentsQueryKey([IDENTITY, { host: null, version: null, extra: 1 }])).toBe(
      false,
    )
    expect(isReviewCommentsQueryKey([IDENTITY])).toBe(false)
    expect(isReviewCommentsQueryKey([IDENTITY, { host: null, version: null }])).toBe(true)
  })

  it('rejects malformed identities and the mobile key layout', () => {
    expect(isReviewCommentsQueryKey([{ domain: 'review', name: 'comments' }, DAEMON])).toBe(false)
    expect(
      isReviewCommentsQueryKey([{ domain: 'review', name: 'comments', projectPath: 12 }, DAEMON]),
    ).toBe(false)
    expect(isReviewCommentsQueryKey([{ ...IDENTITY, extra: true }, DAEMON])).toBe(false)
    expect(isReviewCommentsQueryKey(['daemon', 'env-1', IDENTITY])).toBe(false)
    expect(isReviewCommentsQueryKey([IDENTITY, DAEMON, 'extra'])).toBe(false)
  })
})
