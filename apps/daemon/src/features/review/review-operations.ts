import type { SessionChange } from '@porcelain/contracts/session'
import { createReviewCommentOperations, type ReviewCommentOperations } from './comment-operations'
import {
  createReviewLifecycleOperations,
  type ReviewLifecycleOperations,
} from './review-lifecycle-operations'
import {
  createReviewReadingOperations,
  type ReviewReadingOperations,
} from './review-reading-operations'

/**
 * The Review domain's single bound operation family: comments, lifecycle, and
 * reading under one key, so composition never grows a second Review slice to keep
 * in sync.
 */
export type ReviewOperations = ReviewCommentOperations &
  ReviewLifecycleOperations &
  ReviewReadingOperations

export function createReviewOperations(options: {
  publishSessionChange?: (change: SessionChange) => void
}): ReviewOperations {
  return Object.freeze({
    ...createReviewCommentOperations({ publishSessionChange: options.publishSessionChange }),
    ...createReviewLifecycleOperations({}),
    ...createReviewReadingOperations({}),
  })
}
