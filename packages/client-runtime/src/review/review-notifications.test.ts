import { reviewChangedSchema, reviewNotificationFixtures } from '@porcelain/contracts/review'
import { describe, expect, it } from 'vitest'
import { reviewCommentsQuery } from './comment-queries'
import { reviewNotificationEffects } from './review-notifications'
import {
  reviewActiveQuery,
  reviewArchivedQuery,
  reviewEvidenceQuery,
  reviewExploreQuery,
  reviewedPathsQuery,
  reviewInboxQuery,
  reviewIntentQuery,
  reviewPublishCostQuery,
  reviewReadingQuery,
} from './review-queries'
import {
  reviewEvidenceAssetQueryFamily,
  reviewEvidenceDocQueryFamily,
} from './review-query-effects'

const notification = reviewChangedSchema.parse(reviewNotificationFixtures['review.changed'])
const PROJECT = notification.projectPath

describe('reviewNotificationEffects', () => {
  it('maps review.changed to exactly the ten stale effects of its project', () => {
    expect(reviewNotificationEffects(notification)).toEqual([
      reviewActiveQuery(PROJECT),
      reviewReadingQuery(PROJECT),
      reviewIntentQuery(PROJECT),
      reviewEvidenceQuery(PROJECT),
      reviewEvidenceDocQueryFamily(PROJECT),
      reviewEvidenceAssetQueryFamily(PROJECT),
      reviewedPathsQuery(PROJECT),
      reviewCommentsQuery(PROJECT),
      reviewPublishCostQuery(PROJECT),
      reviewArchivedQuery(PROJECT),
    ])
  })

  it('excludes the inbox, explore, and every foreign domain', () => {
    const effects = reviewNotificationEffects(notification)
    expect(effects).not.toContainEqual(reviewInboxQuery(PROJECT))
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
