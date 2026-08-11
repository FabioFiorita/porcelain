/**
 * Web Review domain feature public entry (RVC-003).
 *
 * Comments are the first Review client slice. Presentation imports the stable
 * comments subdomain (`@renderer/features/review/comments`); this root satisfies
 * architecture registration and re-exports that public surface.
 */

export {
  applyReviewCommentNotification,
  buildCommentIndex,
  type CommentIndex,
  invalidateAllReviewComments,
  type NewComment,
  useCommentActions,
  useCommentIndex,
  useReviewCommentNotificationSubscription,
  useReviewComments,
} from './comments'
