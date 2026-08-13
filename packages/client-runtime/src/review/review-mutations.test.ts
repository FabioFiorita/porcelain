import { reviewContractFixtures, reviewProcedures } from '@porcelain/contracts/review'
import { describe, expect, it } from 'vitest'
import { reviewMutations } from './review-mutations'
import {
  reviewArchivedQuery,
  reviewEvidenceAssetsQuery,
  reviewEvidenceDocsQuery,
  reviewEvidenceHtmlQuery,
  reviewEvidenceQuery,
  reviewedPathsQuery,
  reviewIntentQuery,
  reviewPublishCostQuery,
  reviewReadingQuery,
  reviewViewQuery,
} from './review-queries'
import { type ReviewQueryEffect, reviewEvidenceAssetQueryFamily } from './review-query-effects'

const fixtures = reviewContractFixtures
const PROJECT = fixtures.featureView.input
const OTHER = '/synthetic/other-repo'

function activeReviewEffectsFor(projectPath: string): readonly ReviewQueryEffect[] {
  return [
    reviewViewQuery(projectPath),
    reviewReadingQuery(projectPath),
    reviewIntentQuery(projectPath),
    reviewEvidenceQuery(projectPath),
    reviewEvidenceHtmlQuery(projectPath),
    reviewEvidenceDocsQuery(projectPath),
    reviewEvidenceAssetsQuery(projectPath),
    reviewEvidenceAssetQueryFamily(projectPath),
    reviewedPathsQuery(projectPath),
    reviewPublishCostQuery(projectPath),
    reviewArchivedQuery(projectPath),
  ]
}

describe('reviewMutations', () => {
  it('declares exactly the eight non-comment Review mutations, bound to live procedures', () => {
    expect(Object.keys(reviewMutations)).toEqual([
      'markReviewed',
      'unmarkReviewed',
      'setReviewed',
      'archiveReview',
      'publishReview',
      'restoreArchivedReview',
      'deleteArchivedReview',
      'clearEvidence',
    ])
    expect(reviewMutations.markReviewed.procedure).toBe(reviewProcedures.markReviewed)
    expect(reviewMutations.markReviewed.procedureName).toBe('markReviewed')
    expect(reviewMutations.unmarkReviewed.procedure).toBe(reviewProcedures.unmarkReviewed)
    expect(reviewMutations.unmarkReviewed.procedureName).toBe('unmarkReviewed')
    expect(reviewMutations.setReviewed.procedure).toBe(reviewProcedures.setReviewed)
    expect(reviewMutations.setReviewed.procedureName).toBe('setReviewed')
    expect(reviewMutations.archiveReview.procedure).toBe(reviewProcedures.clearFeatureReview)
    expect(reviewMutations.archiveReview.procedureName).toBe('clearFeatureReview')
    expect(reviewMutations.publishReview.procedure).toBe(reviewProcedures.publishReview)
    expect(reviewMutations.publishReview.procedureName).toBe('publishReview')
    expect(reviewMutations.restoreArchivedReview.procedure).toBe(
      reviewProcedures.restoreArchivedReview,
    )
    expect(reviewMutations.restoreArchivedReview.procedureName).toBe('restoreArchivedReview')
    expect(reviewMutations.deleteArchivedReview.procedure).toBe(
      reviewProcedures.deleteArchivedReview,
    )
    expect(reviewMutations.deleteArchivedReview.procedureName).toBe('deleteArchivedReview')
    expect(reviewMutations.clearEvidence.procedure).toBe(reviewProcedures.clearLoopEvidence)
    expect(reviewMutations.clearEvidence.procedureName).toBe('clearLoopEvidence')
    for (const definition of Object.values(reviewMutations)) {
      expect(definition.requiresAuthoritativeRefetch).toBe(true)
    }
  })

  it('keeps the three reviewed-mark writes optimistic and reviewed-paths only', () => {
    expect(reviewMutations.markReviewed.affectedQueries(fixtures.markReviewed.input)).toEqual([
      reviewedPathsQuery(PROJECT),
    ])
    expect(reviewMutations.unmarkReviewed.affectedQueries(fixtures.unmarkReviewed.input)).toEqual([
      reviewedPathsQuery(PROJECT),
    ])
    expect(reviewMutations.setReviewed.affectedQueries(fixtures.setReviewed.input)).toEqual([
      reviewedPathsQuery(PROJECT),
    ])
    expect(reviewMutations.markReviewed.affectedQueries(fixtures.markReviewed.input)).not.toEqual([
      reviewedPathsQuery(OTHER),
    ])

    const optimistic = Object.entries(reviewMutations)
      .filter(([, definition]) => definition.optimistic)
      .map(([key]) => key)
    expect(optimistic).toEqual(['markReviewed', 'unmarkReviewed', 'setReviewed'])
  })

  it('makes the whole active review stale on archive, publish, and restore', () => {
    expect(
      reviewMutations.archiveReview.affectedQueries(fixtures.clearFeatureReview.input),
    ).toEqual(activeReviewEffectsFor(PROJECT))
    expect(reviewMutations.publishReview.affectedQueries(fixtures.publishReview.input)).toEqual(
      activeReviewEffectsFor(PROJECT),
    )
    expect(
      reviewMutations.restoreArchivedReview.affectedQueries(fixtures.restoreArchivedReview.input),
    ).toEqual(activeReviewEffectsFor(PROJECT))
    expect(
      reviewMutations.archiveReview.affectedQueries(fixtures.clearFeatureReview.input),
    ).toHaveLength(11)
  })

  it('makes only the archive list stale on delete', () => {
    expect(
      reviewMutations.deleteArchivedReview.affectedQueries(fixtures.deleteArchivedReview.input),
    ).toEqual([reviewArchivedQuery(PROJECT)])
  })

  it('leaves the rest of the active review alone on clear-evidence', () => {
    const effects = reviewMutations.clearEvidence.affectedQueries(fixtures.clearLoopEvidence.input)
    expect(effects).toEqual([
      reviewReadingQuery(PROJECT),
      reviewEvidenceQuery(PROJECT),
      reviewEvidenceHtmlQuery(PROJECT),
      reviewEvidenceDocsQuery(PROJECT),
      reviewEvidenceAssetsQuery(PROJECT),
      reviewEvidenceAssetQueryFamily(PROJECT),
      reviewPublishCostQuery(PROJECT),
    ])
    expect(effects).not.toContainEqual(reviewViewQuery(PROJECT))
    expect(effects).not.toContainEqual(reviewIntentQuery(PROJECT))
    expect(effects).not.toContainEqual(reviewedPathsQuery(PROJECT))
    expect(effects).not.toContainEqual(reviewArchivedQuery(PROJECT))
  })

  it('never declares a foreign-domain or comments identity', () => {
    const declared = [
      reviewMutations.markReviewed.affectedQueries(fixtures.markReviewed.input),
      reviewMutations.unmarkReviewed.affectedQueries(fixtures.unmarkReviewed.input),
      reviewMutations.setReviewed.affectedQueries(fixtures.setReviewed.input),
      reviewMutations.archiveReview.affectedQueries(fixtures.clearFeatureReview.input),
      reviewMutations.publishReview.affectedQueries(fixtures.publishReview.input),
      reviewMutations.restoreArchivedReview.affectedQueries(fixtures.restoreArchivedReview.input),
      reviewMutations.deleteArchivedReview.affectedQueries(fixtures.deleteArchivedReview.input),
      reviewMutations.clearEvidence.affectedQueries(fixtures.clearLoopEvidence.input),
    ].flat()
    for (const effect of declared) {
      expect(effect.domain).toBe('review')
      expect(effect.name).not.toBe('comments')
    }
  })
})
