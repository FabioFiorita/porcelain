import type { ReviewChanged } from '@porcelain/contracts/review'
import { type ReviewCommentsQuery, reviewCommentsQuery } from './comment-queries'

/**
 * Review-comments notification → query identity mapping (RVC-002).
 *
 * Accepts only the RVC-001 / RT-001 `review.changed` notification. Maps to the comments
 * identity only — no other Review queries, no default branch, no raw event strings, no
 * entity payload application.
 */

/** Map a validated Review change notification to the comments query identity. */
export function reviewCommentNotificationEffects(
  notification: ReviewChanged,
): readonly ReviewCommentsQuery[] {
  return [reviewCommentsQuery(notification.projectPath)]
}
