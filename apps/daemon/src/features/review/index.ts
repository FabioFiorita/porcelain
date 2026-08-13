/**
 * Review domain public surface for daemon composition.
 * Comment, lifecycle, reading (the active review, its document, exploration, and the
 * inbox), and Evidence (checks, Results, Assets, clear) procedures live here; the
 * remaining Review procedures (Intent, `loopEvidenceHtml`, reviewed marks) stay under
 * router/review.ts until REV-009.
 */

export {
  createReviewCommentOperations,
  type ReviewCommentOperations,
} from './comment-operations'
export { createReviewCommentRouter } from './comment-router'
export type {
  ReviewEvidenceDocDescriptor,
  ReviewEvidencePack,
  ReviewEvidenceStore,
} from './review-evidence-capabilities'
export {
  createReviewEvidenceOperations,
  type ReviewEvidenceOperations,
} from './review-evidence-operations'
export { createReviewEvidenceRouter } from './review-evidence-router'
export type {
  ArchivedReviewMeta,
  ReviewPublishCost,
  ReviewPublishOutcome,
} from './review-lifecycle-capabilities'
export { createReviewLifecycleRouter } from './review-lifecycle-router'
export { createReviewOperations, type ReviewOperations } from './review-operations'
export type {
  InboxRow,
  ReviewEvidence,
  ReviewEvidenceSummary,
  ReviewFiles,
  ReviewGit,
  ReviewReadingSources,
} from './review-reading-capabilities'
export {
  createReviewReadingOperations,
  type ReviewReadingOperations,
} from './review-reading-operations'
export { createReviewReadingRouter } from './review-reading-router'
