/**
 * Web Review domain feature public entry point (RVC-003, REV-007).
 *
 * One owner for Review server state on Web: the key namespace, the effect filter, the
 * nine reads, the five writes, the notification subscription, the two presentation
 * stores, and the Review surfaces. Other Web regions import this module only — never a
 * Review implementation file.
 */

export { ActiveReview } from './active-review'
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
export { EvidenceGallery } from './evidence-gallery'
export { EvidencePanel } from './evidence-panel'
export { ExploreView } from './explore-view'
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
export { ReviewInbox } from './review-inbox'
export { ReviewList, SourceMarker } from './review-list'
export {
  useArchiveReview,
  useClearEvidence,
  useDeleteArchivedReview,
  usePublishReview,
  useRestoreArchivedReview,
} from './review-mutations'
export type { ApplyReviewQueryNotificationOptions } from './review-notifications'
export {
  applyReviewQueryNotification,
  useReviewNotificationSubscription,
} from './review-notifications'
export {
  useActiveReview,
  useArchivedReviews,
  useEvidenceAsset,
  useEvidenceDoc,
  useExplore,
  useReviewEvidence,
  useReviewIntent,
  useReviewPublishCost,
  useReviewReading,
} from './review-queries'
export {
  invalidateAllReviewQueries,
  invalidateReviewEffects,
  invalidateReviewProject,
  isReviewQueryKey,
  parseReviewQueryKey,
  reviewQueryKey,
} from './review-query-filter'
export { useReviewStartStore } from './review-start-store'
