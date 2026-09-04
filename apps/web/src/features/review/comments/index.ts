/**
 * Web Review comments feature public entry point.
 *
 * Other Web regions import this module only. The code-split Canvas reader is the narrow exception:
 * it imports its two hooks directly so Rollup does not form a cross-chunk re-export cycle.
 */

export type { CommentIndex } from './comment-index'
export { type NewComment, useCommentActions } from './comment-mutations'
export {
  invalidateAllReviewComments,
  useReviewCommentNotificationSubscription,
} from './comment-notifications'
export { useCommentIndex, useReviewComments } from './comment-queries'
