/**
 * Web Review domain feature public entry point.
 *
 * One owner for Review server state on Web: the key namespace, the effect filter, the
 * nine reads, the five writes, the notification subscription, the two presentation
 * stores, and the Review surfaces. Other Web regions import this module only — never a
 * Review implementation file.
 */

export {
  type CommentIndex,
  invalidateAllReviewComments,
  type NewComment,
  useCommentActions,
  useCommentIndex,
  useReviewCommentNotificationSubscription,
  useReviewComments,
} from './comments'
export { reviewReadinessIdentity, useReviewReadiness } from './review-readiness'
