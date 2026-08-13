import {
  type DeleteArchivedReviewInput,
  type MarkReviewedInput,
  type RestoreArchivedReviewInput,
  type ReviewRepoPathInput,
  reviewProcedures,
  type SetReviewedInput,
  type UnmarkReviewedInput,
} from '@porcelain/contracts/review'
import {
  reviewArchivedQuery,
  reviewEvidenceAssetsQuery,
  reviewEvidenceDocsQuery,
  reviewEvidenceHtmlQuery,
  reviewEvidenceQuery,
  reviewedPathsQuery,
  reviewIntentQuery,
  reviewProjectKey,
  reviewPublishCostQuery,
  reviewReadingQuery,
  reviewViewQuery,
} from './review-queries'
import { type ReviewQueryEffect, reviewEvidenceAssetQueryFamily } from './review-query-effects'

/**
 * Review mutation consequence definitions outside comments (REV-006).
 *
 * Each entry binds exactly one live Review procedure and the Review identities it makes
 * stale. Only the three reviewed-mark writes are optimistic — the rest perform Git,
 * filesystem and process effects whose success the client cannot predict. Cross-domain
 * refreshes (`gitStatus` after publish, `repoLayers` on review change) stay in the Git and
 * Project Data bridges that own them, as in `project-data-mutations.ts`.
 */

type ReviewMutationProcedureName =
  | 'markReviewed'
  | 'unmarkReviewed'
  | 'setReviewed'
  | 'clearFeatureReview'
  | 'publishReview'
  | 'restoreArchivedReview'
  | 'deleteArchivedReview'
  | 'clearLoopEvidence'

export type ReviewMutationDefinition<TName extends ReviewMutationProcedureName, TInput> = {
  readonly procedure: (typeof reviewProcedures)[TName]
  readonly procedureName: TName
  readonly affectedQueries: (input: TInput) => readonly ReviewQueryEffect[]
  readonly optimistic: boolean
  readonly requiresAuthoritativeRefetch: true
}

/**
 * Everything a whole-active-review write makes stale. Slice-internal: the notification
 * mapping declares the same eleven effects, and one owner keeps them from drifting apart.
 */
export function activeReviewEffects(projectPath: string): readonly ReviewQueryEffect[] {
  const key = reviewProjectKey(projectPath)
  return [
    reviewViewQuery(key),
    reviewReadingQuery(key),
    reviewIntentQuery(key),
    reviewEvidenceQuery(key),
    reviewEvidenceHtmlQuery(key),
    reviewEvidenceDocsQuery(key),
    reviewEvidenceAssetsQuery(key),
    reviewEvidenceAssetQueryFamily(key),
    reviewedPathsQuery(key),
    reviewPublishCostQuery(key),
    reviewArchivedQuery(key),
  ]
}

export const reviewMutations = {
  markReviewed: {
    procedure: reviewProcedures.markReviewed,
    procedureName: 'markReviewed',
    affectedQueries: (input: MarkReviewedInput): readonly ReviewQueryEffect[] => [
      reviewedPathsQuery(input.repoPath),
    ],
    optimistic: true,
    requiresAuthoritativeRefetch: true,
  },
  unmarkReviewed: {
    procedure: reviewProcedures.unmarkReviewed,
    procedureName: 'unmarkReviewed',
    affectedQueries: (input: UnmarkReviewedInput): readonly ReviewQueryEffect[] => [
      reviewedPathsQuery(input.repoPath),
    ],
    optimistic: true,
    requiresAuthoritativeRefetch: true,
  },
  setReviewed: {
    procedure: reviewProcedures.setReviewed,
    procedureName: 'setReviewed',
    affectedQueries: (input: SetReviewedInput): readonly ReviewQueryEffect[] => [
      reviewedPathsQuery(input.repoPath),
    ],
    optimistic: true,
    requiresAuthoritativeRefetch: true,
  },
  archiveReview: {
    procedure: reviewProcedures.clearFeatureReview,
    procedureName: 'clearFeatureReview',
    affectedQueries: (input: ReviewRepoPathInput): readonly ReviewQueryEffect[] =>
      activeReviewEffects(input),
    optimistic: false,
    requiresAuthoritativeRefetch: true,
  },
  publishReview: {
    procedure: reviewProcedures.publishReview,
    procedureName: 'publishReview',
    affectedQueries: (input: ReviewRepoPathInput): readonly ReviewQueryEffect[] =>
      activeReviewEffects(input),
    optimistic: false,
    requiresAuthoritativeRefetch: true,
  },
  restoreArchivedReview: {
    procedure: reviewProcedures.restoreArchivedReview,
    procedureName: 'restoreArchivedReview',
    affectedQueries: (input: RestoreArchivedReviewInput): readonly ReviewQueryEffect[] =>
      activeReviewEffects(input.repoPath),
    optimistic: false,
    requiresAuthoritativeRefetch: true,
  },
  deleteArchivedReview: {
    procedure: reviewProcedures.deleteArchivedReview,
    procedureName: 'deleteArchivedReview',
    affectedQueries: (input: DeleteArchivedReviewInput): readonly ReviewQueryEffect[] => [
      reviewArchivedQuery(input.repoPath),
    ],
    optimistic: false,
    requiresAuthoritativeRefetch: true,
  },
  clearEvidence: {
    procedure: reviewProcedures.clearLoopEvidence,
    procedureName: 'clearLoopEvidence',
    affectedQueries: (input: ReviewRepoPathInput): readonly ReviewQueryEffect[] => {
      const key = reviewProjectKey(input)
      return [
        reviewReadingQuery(key),
        reviewEvidenceQuery(key),
        reviewEvidenceHtmlQuery(key),
        reviewEvidenceDocsQuery(key),
        reviewEvidenceAssetsQuery(key),
        reviewEvidenceAssetQueryFamily(key),
        reviewPublishCostQuery(key),
      ]
    },
    optimistic: false,
    requiresAuthoritativeRefetch: true,
  },
} as const satisfies {
  readonly markReviewed: ReviewMutationDefinition<'markReviewed', MarkReviewedInput>
  readonly unmarkReviewed: ReviewMutationDefinition<'unmarkReviewed', UnmarkReviewedInput>
  readonly setReviewed: ReviewMutationDefinition<'setReviewed', SetReviewedInput>
  readonly archiveReview: ReviewMutationDefinition<'clearFeatureReview', ReviewRepoPathInput>
  readonly publishReview: ReviewMutationDefinition<'publishReview', ReviewRepoPathInput>
  readonly restoreArchivedReview: ReviewMutationDefinition<
    'restoreArchivedReview',
    RestoreArchivedReviewInput
  >
  readonly deleteArchivedReview: ReviewMutationDefinition<
    'deleteArchivedReview',
    DeleteArchivedReviewInput
  >
  readonly clearEvidence: ReviewMutationDefinition<'clearLoopEvidence', ReviewRepoPathInput>
}

export type ReviewMutation = (typeof reviewMutations)[keyof typeof reviewMutations]
