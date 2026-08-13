import { describe, expect, it } from 'vitest'
import { reviewCommentsQuery } from './comment-queries'
import {
  reviewActiveQuery,
  reviewArchivedQuery,
  reviewEvidenceAssetQuery,
  reviewEvidenceQuery,
  reviewedPathsQuery,
  reviewReadingQuery,
} from './review-queries'
import {
  dedupeReviewQueryEffects,
  reviewEvidenceAssetQueryFamily,
  reviewQueryEffectMatchesQuery,
} from './review-query-effects'

const PROJECT = '/synthetic/repo'
const OTHER_PROJECT = '/synthetic/other-repo'

describe('reviewEvidenceAssetQueryFamily', () => {
  it('matches every evidence-asset identity of its project only', () => {
    const family = reviewEvidenceAssetQueryFamily(PROJECT)
    expect(reviewQueryEffectMatchesQuery(reviewEvidenceAssetQuery(PROJECT, 'a.png'), family)).toBe(
      true,
    )
    expect(reviewQueryEffectMatchesQuery(reviewEvidenceAssetQuery(PROJECT, 'b.png'), family)).toBe(
      true,
    )
    expect(
      reviewQueryEffectMatchesQuery(reviewEvidenceAssetQuery(OTHER_PROJECT, 'a.png'), family),
    ).toBe(false)
  })

  it('matches no other Review identity', () => {
    const family = reviewEvidenceAssetQueryFamily(PROJECT)
    const others = [
      reviewActiveQuery(PROJECT),
      reviewReadingQuery(PROJECT),
      reviewEvidenceQuery(PROJECT),
      reviewedPathsQuery(PROJECT),
      reviewArchivedQuery(PROJECT),
      reviewCommentsQuery(PROJECT),
    ]
    for (const query of others) {
      expect(reviewQueryEffectMatchesQuery(query, family)).toBe(false)
    }
  })
})

describe('reviewQueryEffectMatchesQuery', () => {
  it('matches an exact identity against itself only', () => {
    expect(
      reviewQueryEffectMatchesQuery(reviewActiveQuery(PROJECT), reviewActiveQuery(PROJECT)),
    ).toBe(true)
    expect(
      reviewQueryEffectMatchesQuery(reviewActiveQuery(PROJECT), reviewReadingQuery(PROJECT)),
    ).toBe(false)
    expect(
      reviewQueryEffectMatchesQuery(reviewActiveQuery(PROJECT), reviewActiveQuery(OTHER_PROJECT)),
    ).toBe(false)
    expect(
      reviewQueryEffectMatchesQuery(
        reviewEvidenceAssetQuery(PROJECT, 'a.png'),
        reviewEvidenceAssetQuery(PROJECT, 'b.png'),
      ),
    ).toBe(false)
  })
})

describe('dedupeReviewQueryEffects', () => {
  it('collapses repeats while preserving first-seen order', () => {
    const effects = dedupeReviewQueryEffects([
      reviewActiveQuery(PROJECT),
      reviewEvidenceAssetQueryFamily(PROJECT),
      reviewActiveQuery(PROJECT),
      reviewEvidenceAssetQueryFamily(OTHER_PROJECT),
      reviewEvidenceAssetQueryFamily(PROJECT),
    ])
    expect(effects).toEqual([
      reviewActiveQuery(PROJECT),
      reviewEvidenceAssetQueryFamily(PROJECT),
      reviewEvidenceAssetQueryFamily(OTHER_PROJECT),
    ])
  })
})
