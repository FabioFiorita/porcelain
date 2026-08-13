import { reviewChangedSchema, reviewNotificationFixtures } from '@porcelain/contracts/review'
import { describe, expect, it } from 'vitest'
import { reviewCommentsQuery } from './comment-queries'
import { reviewNotificationEffects } from './review-notifications'
import {
  reviewArchivedQuery,
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
} from './review-queries'
import { reviewEvidenceAssetQueryFamily } from './review-query-effects'

const notification = reviewChangedSchema.parse(reviewNotificationFixtures['review.changed'])
const PROJECT = notification.projectPath

describe('reviewNotificationEffects', () => {
  it('maps review.changed to exactly the eleven active-review effects of its project', () => {
    expect(reviewNotificationEffects(notification)).toEqual([
      reviewViewQuery(PROJECT),
      reviewReadingQuery(PROJECT),
      reviewIntentQuery(PROJECT),
      reviewEvidenceQuery(PROJECT),
      reviewEvidenceHtmlQuery(PROJECT),
      reviewEvidenceDocsQuery(PROJECT),
      reviewEvidenceAssetsQuery(PROJECT),
      reviewEvidenceAssetQueryFamily(PROJECT),
      reviewedPathsQuery(PROJECT),
      reviewPublishCostQuery(PROJECT),
      reviewArchivedQuery(PROJECT),
    ])
  })

  it('excludes comments, worktree-inbox, explore, and every foreign domain', () => {
    const effects = reviewNotificationEffects(notification)
    expect(effects).not.toContainEqual(reviewCommentsQuery(PROJECT))
    expect(effects).not.toContainEqual(worktreeInboxQuery(PROJECT))
    expect(effects).not.toContainEqual(
      reviewExploreQuery(PROJECT, { kind: 'file', path: 'src/changed.ts' }),
    )
    for (const effect of effects) {
      expect(effect.domain).toBe('review')
      expect(effect.projectPath).toBe(PROJECT)
    }
  })

  it('returns a deduplicated list', () => {
    const effects = reviewNotificationEffects(notification)
    const keys = effects.map((effect) => JSON.stringify(effect))
    expect(new Set(keys).size).toBe(keys.length)
  })
})
