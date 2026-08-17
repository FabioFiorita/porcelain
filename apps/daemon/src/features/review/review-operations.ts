import type { SessionChange } from '@porcelain/contracts/session'
import { createReviewCommentOperations, type ReviewCommentOperations } from './comment-operations'
import { createReviewMarksOperations, type ReviewMarksOperations } from './review-marks-operations'

/**
 * The Review domain's single bound operation family: comments, reading,
 * Evidence, and reviewed marks under one key, so composition never grows a second
 * Review slice to keep in sync.
 */
export type ReviewOperations = ReviewCommentOperations & ReviewMarksOperations

export function createReviewOperations(options: {
  publishSessionChange?: (change: SessionChange) => void
}): ReviewOperations {
  return Object.freeze({
    ...createReviewCommentOperations({ publishSessionChange: options.publishSessionChange }),
    ...createReviewMarksOperations({}),
  })
}
