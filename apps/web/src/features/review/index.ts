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
export { formatBytes } from './format-bytes'
export { EvidenceChecksRow, EvidenceHeaderRow } from './reading-evidence-rows'
export { ReadingSurfaceBody } from './reading-surface'
export { ReviewDocBody } from './review-doc-body'
export {
  jumpTargets,
  nextTarget,
  type ReviewDocShape,
  type ReviewFocusSection,
  type ReviewJumpTarget,
  useReviewFocusStore,
} from './review-focus-store'
