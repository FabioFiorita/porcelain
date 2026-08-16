/**
 * Shared Review client semantics for comments and reviewed marks.
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
export {
  type ReviewedPathsQuery,
  ReviewIdentityError,
  type ReviewQuery,
  reviewedPathsQuery,
  reviewedPathsQuerySchema,
  reviewProjectKey,
  reviewQuerySchema,
} from './review-queries'
export {
  dedupeReviewQueryEffects,
  type ReviewQueryEffect,
  reviewQueryEffectMatchesQuery,
} from './review-query-effects'
export {
  applyReviewedMarksTransition,
  type ReviewedMarksMutationKey,
  type ReviewedMarksSnapshot,
  rollbackReviewedMarksTransition,
} from './reviewed-marks-reconciliation'
