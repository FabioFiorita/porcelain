import { gitStatusQuery } from '@porcelain/client-runtime/git'
import {
  reviewActiveQuery,
  reviewArchivedQuery,
  reviewCommentsQuery,
  reviewEvidenceAssetQuery,
  reviewEvidenceDocQuery,
  reviewEvidenceQuery,
  reviewExploreQuery,
  reviewedPathsQuery,
  reviewInboxQuery,
  reviewIntentQuery,
  reviewPublishCostQuery,
  reviewReadingQuery,
} from '@porcelain/client-runtime/review'
import type { DaemonScope } from '@renderer/lib/daemon-scope'
import { describe, expect, it } from 'vitest'
import { isReviewQueryKey, parseReviewQueryKey, reviewQueryKey } from './review-query-key'

const DAEMON: DaemonScope = { host: '127.0.0.1:43118', version: '0.0.0-test' }
const PROJECT = '/synthetic/repo'

const identities = [
  reviewActiveQuery(PROJECT),
  reviewReadingQuery(PROJECT),
  reviewIntentQuery(PROJECT),
  reviewEvidenceQuery(PROJECT),
  reviewEvidenceDocQuery(PROJECT, 'results.md'),
  reviewEvidenceAssetQuery(PROJECT, 'shot.png'),
  reviewPublishCostQuery(PROJECT),
  reviewArchivedQuery(PROJECT),
  reviewExploreQuery(PROJECT, { kind: 'file', path: 'src/a.ts' }),
] as const

describe('reviewQueryKey', () => {
  it('puts the semantic identity first and the daemon scope second for every identity', () => {
    expect(identities).toHaveLength(9)
    for (const identity of identities) {
      expect(reviewQueryKey(DAEMON, identity)).toEqual([identity, DAEMON])
    }
  })

  it('round-trips a built key back to its identity and daemon', () => {
    for (const identity of identities) {
      expect(parseReviewQueryKey(reviewQueryKey(DAEMON, identity))).toEqual({
        daemon: DAEMON,
        query: identity,
      })
    }
  })

  it('rejects keys that are not a Review identity', () => {
    expect(parseReviewQueryKey([gitStatusQuery(PROJECT), DAEMON])).toBeNull()
    expect(
      parseReviewQueryKey([{ domain: 'board', name: 'cards', projectPath: PROJECT }, DAEMON]),
    ).toBeNull()
    expect(parseReviewQueryKey(['activeReview', PROJECT])).toBeNull()
    expect(
      parseReviewQueryKey([
        { domain: 'review', name: 'not-a-review-read', projectPath: PROJECT },
        DAEMON,
      ]),
    ).toBeNull()
  })

  it('accepts the comments identity and the two Git-keyed Review identities', () => {
    // Both are members of `reviewQuerySchema`; comments still invalidate through their own
    // owner, and `reviewed-paths` / `inbox` stay Git-keyed caches (REV-006 ruling 2).
    expect(isReviewQueryKey(reviewQueryKey(DAEMON, reviewCommentsQuery(PROJECT)))).toBe(true)
    expect(isReviewQueryKey(reviewQueryKey(DAEMON, reviewedPathsQuery(PROJECT)))).toBe(true)
    expect(isReviewQueryKey(reviewQueryKey(DAEMON, reviewInboxQuery(PROJECT)))).toBe(true)
  })

  it('rejects a Git workspace key', () => {
    expect(isReviewQueryKey([gitStatusQuery(PROJECT), DAEMON])).toBe(false)
  })
})
