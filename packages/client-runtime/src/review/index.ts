/**
 * Shared Review client semantics (RVC-002 comments, REV-006 everything else).
 *
 * Framework-neutral query identities, mutation consequences, pure optimistic transitions,
 * and `review.changed` notification mappings. Web and mobile adapters bind these
 * definitions to their transport and TanStack Query layers (RVC-003, RVC-004, REV-007,
 * REV-008).
 */

export {
  type ReviewCommentMutation,
  type ReviewCommentMutationDefinition,
  reviewCommentMutations,
} from './comment-mutations'
export { reviewCommentNotificationEffects } from './comment-notifications'
export {
  type ReviewCommentsQuery,
  reviewCommentsQuery,
  reviewCommentsQuerySchema,
} from './comment-queries'
export {
  applyReviewCommentOptimisticTransition,
  type ReviewCommentMutationKey,
  type ReviewCommentOptimisticContext,
  type ReviewCommentOptimisticSnapshot,
  type ReviewCommentOptimisticTransitionResult,
  reconcileReviewCommentMutation,
  rollbackReviewCommentOptimisticTransition,
} from './comment-reconciliation'
export {
  type ReviewMutation,
  type ReviewMutationDefinition,
  reviewMutations,
} from './review-mutations'
export { reviewNotificationEffects } from './review-notifications'
export {
  type ReviewArchivedQuery,
  type ReviewEvidenceAssetQuery,
  type ReviewEvidenceAssetsQuery,
  type ReviewEvidenceDocsQuery,
  type ReviewEvidenceHtmlQuery,
  type ReviewEvidenceQuery,
  type ReviewExploreQuery,
  type ReviewExploreSeed,
  type ReviewedPathsQuery,
  ReviewIdentityError,
  type ReviewIntentQuery,
  type ReviewPublishCostQuery,
  type ReviewQuery,
  type ReviewReadingQuery,
  type ReviewViewQuery,
  reviewArchivedQuery,
  reviewEvidenceAssetQuery,
  reviewEvidenceAssetsQuery,
  reviewEvidenceDocsQuery,
  reviewEvidenceHtmlQuery,
  reviewEvidenceQuery,
  reviewExploreQuery,
  reviewedPathsQuery,
  reviewedPathsQuerySchema,
  reviewIntentQuery,
  reviewProjectKey,
  reviewPublishCostQuery,
  reviewQuerySchema,
  reviewReadingQuery,
  reviewReadingQuerySchema,
  reviewViewQuery,
  reviewViewQuerySchema,
  type WorktreeInboxQuery,
  worktreeInboxQuery,
  worktreeInboxQuerySchema,
} from './review-queries'
export {
  dedupeReviewQueryEffects,
  type ReviewQueryEffect,
  reviewEvidenceAssetQueryFamily,
  reviewQueryEffectMatchesQuery,
} from './review-query-effects'
export {
  applyReviewedMarksTransition,
  type ReviewedMarksMutationKey,
  type ReviewedMarksSnapshot,
  rollbackReviewedMarksTransition,
} from './reviewed-marks-reconciliation'
