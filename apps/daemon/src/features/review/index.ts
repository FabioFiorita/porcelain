/**
 * Review-comment domain public surface for daemon composition.
 * Comment procedures live here; remaining Review procedures stay under router/review.ts.
 */

export {
  createReviewCommentOperations,
  type ReviewCommentOperations,
} from './comment-operations'
export { createReviewCommentRouter } from './comment-router'
