/**
 * Web Review comments feature public entry point.
 *
 * Other Web regions import this module only — never a comments implementation file.
 */

export type { CommentIndex } from './comment-index'
export { type NewComment, useCommentActions } from './comment-mutations'
export {
  invalidateAllReviewComments,
  useReviewCommentNotificationSubscription,
} from './comment-notifications'
export { useCommentIndex, useReviewComments } from './comment-queries'
