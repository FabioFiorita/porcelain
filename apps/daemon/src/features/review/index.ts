/**
 * Review domain public surface for daemon composition.
 * The whole Review wire lives here: comments, lifecycle, reading (the active review,
 * its document, Intent, exploration, and the inbox), Evidence (the pack, one document,
 * one asset, clear), and the reviewed marks.
 */

export {
  createReviewCommentOperations,
  type ReviewCommentOperations,
} from './comment-operations'
export { createReviewCommentRouter } from './comment-router'
export type {
  ReviewEvidenceAssetDescriptor,
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
export type {
  ReviewedMark,
  ReviewMarksGit,
  ReviewMarksStore,
} from './review-marks-capabilities'
export {
  createReviewMarksOperations,
  type ReviewMarksOperations,
} from './review-marks-operations'
export { createReviewMarksRouter } from './review-marks-router'
export { createReviewOperations, type ReviewOperations } from './review-operations'
export type {
  InboxRow,
  ReviewEvidence,
  ReviewEvidenceSummary,
  ReviewFiles,
  ReviewGit,
  ReviewIntent,
  ReviewReadingSources,
} from './review-reading-capabilities'
export {
  createReviewReadingOperations,
  type ReviewReadingOperations,
} from './review-reading-operations'
export { createReviewReadingRouter } from './review-reading-router'
