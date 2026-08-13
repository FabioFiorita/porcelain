import {
  type ArchivedReviewIdInput,
  REVIEW_STALE_ON_REVIEW_CHANGED,
  type RepoPathInput,
  type ReviewStaleProcedureName,
  reviewProcedures,
  type SetReviewedInput,
} from '@porcelain/contracts/review'
import { reviewCommentsQuery } from './comment-queries'
import {
  reviewActiveQuery,
  reviewArchivedQuery,
  reviewEvidenceQuery,
  reviewedPathsQuery,
  reviewIntentQuery,
  reviewProjectKey,
  reviewPublishCostQuery,
  reviewReadingQuery,
} from './review-queries'
import {
  type ReviewQueryEffect,
  reviewEvidenceAssetQueryFamily,
  reviewEvidenceDocQueryFamily,
} from './review-query-effects'

/**
 * Review mutation consequence definitions outside comments (REV-006).
 *
 * Each entry binds exactly one Review procedure and the Review identities it makes stale.
 * Only the reviewed-mark write is optimistic — the rest perform Git, filesystem and
 * process effects whose success the client cannot predict. Cross-domain refreshes
 * (`gitStatus` after publish, `repoLayers` on review change) stay in the Git and Project
 * Data bridges that own them, as in `project-data-mutations.ts`.
 */

type ReviewMutationProcedureName =
  | 'setReviewed'
  | 'archiveReview'
  | 'publishReview'
  | 'restoreArchivedReview'
  | 'deleteArchivedReview'
  | 'clearEvidence'

export type ReviewMutationDefinition<TName extends ReviewMutationProcedureName, TInput> = {
  readonly procedure: (typeof reviewProcedures)[TName]
  readonly procedureName: TName
  readonly affectedQueries: (input: TInput) => readonly ReviewQueryEffect[]
  readonly optimistic: boolean
  readonly requiresAuthoritativeRefetch: true
}

/**
 * One identity constructor per stale-on-change procedure. The two per-file reads resolve
 * to their families, because a change cannot name which document or image moved.
 */
const staleEffectByProcedure: Record<
  ReviewStaleProcedureName,
  (projectKey: string) => ReviewQueryEffect
> = {
  activeReview: reviewActiveQuery,
  reviewReading: reviewReadingQuery,
  reviewIntent: reviewIntentQuery,
  reviewEvidence: reviewEvidenceQuery,
  reviewEvidenceDoc: reviewEvidenceDocQueryFamily,
  reviewEvidenceAsset: reviewEvidenceAssetQueryFamily,
  reviewedPaths: reviewedPathsQuery,
  reviewComments: reviewCommentsQuery,
  publishCost: reviewPublishCostQuery,
  archivedReviews: reviewArchivedQuery,
}

/**
 * Everything a whole-active-review write makes stale. Slice-internal, and DERIVED from
 * the contract's `REVIEW_STALE_ON_REVIEW_CHANGED` rather than restating it: the wire fact
 * and the cache consequence cannot drift apart, and the notification mapping reads the
 * same list.
 */
export function activeReviewEffects(projectPath: string): readonly ReviewQueryEffect[] {
  const key = reviewProjectKey(projectPath)
  return REVIEW_STALE_ON_REVIEW_CHANGED.map((name) => staleEffectByProcedure[name](key))
}

export const reviewMutations = {
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
    procedure: reviewProcedures.archiveReview,
    procedureName: 'archiveReview',
    affectedQueries: (input: RepoPathInput): readonly ReviewQueryEffect[] =>
      activeReviewEffects(input),
    optimistic: false,
    requiresAuthoritativeRefetch: true,
  },
  publishReview: {
    procedure: reviewProcedures.publishReview,
    procedureName: 'publishReview',
    affectedQueries: (input: RepoPathInput): readonly ReviewQueryEffect[] =>
      activeReviewEffects(input),
    optimistic: false,
    requiresAuthoritativeRefetch: true,
  },
  restoreArchivedReview: {
    procedure: reviewProcedures.restoreArchivedReview,
    procedureName: 'restoreArchivedReview',
    affectedQueries: (input: ArchivedReviewIdInput): readonly ReviewQueryEffect[] =>
      activeReviewEffects(input.repoPath),
    optimistic: false,
    requiresAuthoritativeRefetch: true,
  },
  deleteArchivedReview: {
    procedure: reviewProcedures.deleteArchivedReview,
    procedureName: 'deleteArchivedReview',
    affectedQueries: (input: ArchivedReviewIdInput): readonly ReviewQueryEffect[] => [
      reviewArchivedQuery(input.repoPath),
    ],
    optimistic: false,
    requiresAuthoritativeRefetch: true,
  },
  clearEvidence: {
    procedure: reviewProcedures.clearEvidence,
    procedureName: 'clearEvidence',
    affectedQueries: (input: RepoPathInput): readonly ReviewQueryEffect[] => {
      const key = reviewProjectKey(input)
      return [
        reviewReadingQuery(key),
        reviewEvidenceQuery(key),
        reviewEvidenceDocQueryFamily(key),
        reviewEvidenceAssetQueryFamily(key),
        reviewPublishCostQuery(key),
      ]
    },
    optimistic: false,
    requiresAuthoritativeRefetch: true,
  },
} as const satisfies {
  readonly setReviewed: ReviewMutationDefinition<'setReviewed', SetReviewedInput>
  readonly archiveReview: ReviewMutationDefinition<'archiveReview', RepoPathInput>
  readonly publishReview: ReviewMutationDefinition<'publishReview', RepoPathInput>
  readonly restoreArchivedReview: ReviewMutationDefinition<
    'restoreArchivedReview',
    ArchivedReviewIdInput
  >
  readonly deleteArchivedReview: ReviewMutationDefinition<
    'deleteArchivedReview',
    ArchivedReviewIdInput
  >
  readonly clearEvidence: ReviewMutationDefinition<'clearEvidence', RepoPathInput>
}

export type ReviewMutation = (typeof reviewMutations)[keyof typeof reviewMutations]
