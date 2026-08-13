import type { ReviewChanged } from '@porcelain/contracts/review'
import { activeReviewEffects } from './review-mutations'
import { dedupeReviewQueryEffects, type ReviewQueryEffect } from './review-query-effects'

/**
 * Review notification → freshness mapping outside comments (REV-006).
 *
 * Accepts only the typed `review.changed` notification: no default branch, no raw event
 * string, no entity payload application. It returns exactly the active-review effects.
 * Comments keep their own mapping (`reviewCommentNotificationEffects`); `worktree-inbox`
 * is a cross-worktree Git scan and `explore` is independent of the active review, so
 * neither is stale here.
 */

/** Map a validated Review change notification to every Review read it makes stale. */
export function reviewNotificationEffects(
  notification: ReviewChanged,
): readonly ReviewQueryEffect[] {
  return dedupeReviewQueryEffects(activeReviewEffects(notification.projectPath))
}
