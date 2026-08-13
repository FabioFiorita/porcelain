import { boardCardsQuery } from '@porcelain/client-runtime/board'
import { gitHeadQuery } from '@porcelain/client-runtime/git'
import {
  reviewArchivedQuery,
  reviewCommentsQuery,
  reviewEvidenceAssetQuery,
  reviewEvidenceAssetsQuery,
  reviewEvidenceDocsQuery,
  reviewEvidenceHtmlQuery,
  reviewEvidenceQuery,
  reviewExploreQuery,
  reviewedPathsQuery,
  reviewIntentQuery,
  reviewPublishCostQuery,
  reviewReadingQuery,
  reviewViewQuery,
  worktreeInboxQuery,
} from '@porcelain/client-runtime/review'
import { describe, expect, it } from 'vitest'

import { isReviewQueryKey, parseReviewQueryKey, reviewQueryKey } from './review-query-key'

const ENVIRONMENT = 'env-review-test'
const PROJECT = '/synthetic/repo'

const IDENTITIES = [
  reviewViewQuery(PROJECT),
  reviewReadingQuery(PROJECT),
  reviewIntentQuery(PROJECT),
  reviewEvidenceQuery(PROJECT),
  reviewEvidenceHtmlQuery(PROJECT),
  reviewEvidenceDocsQuery(PROJECT),
  reviewEvidenceAssetsQuery(PROJECT),
  reviewEvidenceAssetQuery(PROJECT, 'shot.png'),
  reviewPublishCostQuery(PROJECT),
  reviewArchivedQuery(PROJECT),
  reviewedPathsQuery(PROJECT),
  worktreeInboxQuery(PROJECT),
  reviewExploreQuery(PROJECT, { kind: 'file', path: 'src/main.ts' }),
] as const

describe('Mobile Review cache keys', () => {
  it('keys every Review identity as daemon, environment, identity — in that order', () => {
    for (const query of IDENTITIES) {
      const key = reviewQueryKey(ENVIRONMENT, query)
      expect(key).toEqual(['daemon', ENVIRONMENT, query])
      expect(parseReviewQueryKey(key)).toEqual({ environmentId: ENVIRONMENT, query })
      expect(isReviewQueryKey(key)).toBe(true)
    }
  })

  it('rejects a foreign key, a bare procedure-name key and an unknown identity', () => {
    expect(parseReviewQueryKey(['daemon', ENVIRONMENT, gitHeadQuery(PROJECT)])).toBeNull()
    expect(parseReviewQueryKey(['daemon', ENVIRONMENT, boardCardsQuery(PROJECT)])).toBeNull()
    // The shape the provider's procedure-name cache entries still use.
    expect(parseReviewQueryKey(['daemon', ENVIRONMENT, 'featureReading', PROJECT])).toBeNull()
    expect(
      parseReviewQueryKey([
        'daemon',
        ENVIRONMENT,
        { domain: 'review', name: 'not-a-review-read', projectPath: PROJECT },
      ]),
    ).toBeNull()
    // A key with a fourth element is a different key, not a Review key with an extra.
    expect(isReviewQueryKey(['daemon', ENVIRONMENT, reviewViewQuery(PROJECT), 'extra'])).toBe(false)
  })

  it('accepts the comments identity and rejects a Git workspace key', () => {
    expect(isReviewQueryKey(reviewQueryKey(ENVIRONMENT, reviewCommentsQuery(PROJECT)))).toBe(true)
    expect(isReviewQueryKey(['daemon', ENVIRONMENT, gitHeadQuery(PROJECT)])).toBe(false)
  })
})
