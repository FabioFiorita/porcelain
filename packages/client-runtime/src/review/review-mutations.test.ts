import { reviewContractFixtures, reviewProcedures } from '@porcelain/contracts/review'
import { describe, expect, it } from 'vitest'
import { reviewCommentsQuery } from './comment-queries'
import { reviewMutations } from './review-mutations'
import {
  reviewActiveQuery,
  reviewArchivedQuery,
  reviewEvidenceQuery,
  reviewedPathsQuery,
  reviewIntentQuery,
  reviewPublishCostQuery,
  reviewReadingQuery,
} from './review-queries'
import {
  type ReviewQueryEffect,
  reviewEvidenceAssetQueryFamily,
  reviewEvidenceDocQueryFamily,
} from './review-query-effects'

const fixtures = reviewContractFixtures
const PROJECT = fixtures.activeReview.input
const OTHER = '/synthetic/other-repo'

function activeReviewEffectsFor(projectPath: string): readonly ReviewQueryEffect[] {
  return [
    reviewActiveQuery(projectPath),
    reviewReadingQuery(projectPath),
    reviewIntentQuery(projectPath),
    reviewEvidenceQuery(projectPath),
    reviewEvidenceDocQueryFamily(projectPath),
    reviewEvidenceAssetQueryFamily(projectPath),
    reviewedPathsQuery(projectPath),
    reviewCommentsQuery(projectPath),
    reviewPublishCostQuery(projectPath),
    reviewArchivedQuery(projectPath),
  ]
}

describe('reviewMutations', () => {
  it('declares exactly the six non-comment Review mutations, bound to live procedures', () => {
    expect(Object.keys(reviewMutations)).toEqual([
      'setReviewed',
      'archiveReview',
      'publishReview',
      'restoreArchivedReview',
      'deleteArchivedReview',
      'clearEvidence',
    ])
    expect(reviewMutations.setReviewed.procedure).toBe(reviewProcedures.setReviewed)
    expect(reviewMutations.setReviewed.procedureName).toBe('setReviewed')
    expect(reviewMutations.archiveReview.procedure).toBe(reviewProcedures.archiveReview)
    expect(reviewMutations.archiveReview.procedureName).toBe('archiveReview')
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
    expect(reviewMutations.clearEvidence.procedure).toBe(reviewProcedures.clearEvidence)
    expect(reviewMutations.clearEvidence.procedureName).toBe('clearEvidence')
    for (const definition of Object.values(reviewMutations)) {
      expect(definition.requiresAuthoritativeRefetch).toBe(true)
    }
  })

  it('declares no per-path mark mutation beside the total write', () => {
    expect(Object.keys(reviewMutations).filter((key) => key.endsWith('Reviewed'))).toEqual([
      'setReviewed',
    ])
  })

  it('keeps the single reviewed-mark write optimistic and reviewed-paths only', () => {
    expect(reviewMutations.setReviewed.affectedQueries(fixtures.setReviewed.input)).toEqual([
      reviewedPathsQuery(PROJECT),
    ])
    expect(reviewMutations.setReviewed.affectedQueries(fixtures.setReviewed.input)).not.toEqual([
      reviewedPathsQuery(OTHER),
    ])

    const optimistic = Object.entries(reviewMutations)
      .filter(([, definition]) => definition.optimistic)
      .map(([key]) => key)
    expect(optimistic).toEqual(['setReviewed'])
  })

  it('makes the whole active review stale on archive, publish, and restore', () => {
    expect(reviewMutations.archiveReview.affectedQueries(fixtures.archiveReview.input)).toEqual(
      activeReviewEffectsFor(PROJECT),
    )
    expect(reviewMutations.publishReview.affectedQueries(fixtures.publishReview.input)).toEqual(
      activeReviewEffectsFor(PROJECT),
    )
    expect(
      reviewMutations.restoreArchivedReview.affectedQueries(fixtures.restoreArchivedReview.input),
    ).toEqual(activeReviewEffectsFor(PROJECT))
    expect(
      reviewMutations.archiveReview.affectedQueries(fixtures.archiveReview.input),
    ).toHaveLength(10)
  })

  it('makes only the archive list stale on delete', () => {
    expect(
      reviewMutations.deleteArchivedReview.affectedQueries(fixtures.deleteArchivedReview.input),
    ).toEqual([reviewArchivedQuery(PROJECT)])
  })

  it('leaves the rest of the active review alone on clear-evidence', () => {
    const effects = reviewMutations.clearEvidence.affectedQueries(fixtures.clearEvidence.input)
    expect(effects).toEqual([
      reviewReadingQuery(PROJECT),
      reviewEvidenceQuery(PROJECT),
      reviewEvidenceDocQueryFamily(PROJECT),
      reviewEvidenceAssetQueryFamily(PROJECT),
      reviewPublishCostQuery(PROJECT),
    ])
    expect(effects).not.toContainEqual(reviewActiveQuery(PROJECT))
    expect(effects).not.toContainEqual(reviewIntentQuery(PROJECT))
    expect(effects).not.toContainEqual(reviewedPathsQuery(PROJECT))
    expect(effects).not.toContainEqual(reviewArchivedQuery(PROJECT))
  })

  it('never declares a foreign-domain identity', () => {
    const declared = [
      reviewMutations.setReviewed.affectedQueries(fixtures.setReviewed.input),
      reviewMutations.archiveReview.affectedQueries(fixtures.archiveReview.input),
      reviewMutations.publishReview.affectedQueries(fixtures.publishReview.input),
      reviewMutations.restoreArchivedReview.affectedQueries(fixtures.restoreArchivedReview.input),
      reviewMutations.deleteArchivedReview.affectedQueries(fixtures.deleteArchivedReview.input),
      reviewMutations.clearEvidence.affectedQueries(fixtures.clearEvidence.input),
    ].flat()
    for (const effect of declared) {
      expect(effect.domain).toBe('review')
    }
  })
})
