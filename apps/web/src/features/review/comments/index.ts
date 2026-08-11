/**
 * Web Review comments feature public entry point (RVC-003).
 *
 * Other Web regions import this module only — never a comments implementation file.
 */

export { buildCommentIndex, type CommentIndex } from './comment-index'
export { type NewComment, useCommentActions } from './comment-mutations'
export {
  applyReviewCommentNotification,
  invalidateAllReviewComments,
  useReviewCommentNotificationSubscription,
} from './comment-notifications'
export { useCommentIndex, useReviewComments } from './comment-queries'
