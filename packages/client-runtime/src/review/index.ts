/**
 * Shared Review-comments client semantics (RVC-002).
 *
 * Framework-neutral query identity, mutation consequences, pure optimistic transitions,
 * and `review.changed` notification mapping. Web and mobile adapters bind these
 * definitions to their transport and TanStack Query layers (RVC-003, RVC-004).
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
