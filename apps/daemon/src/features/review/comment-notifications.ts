import type { SessionChange } from '@porcelain/contracts/session'
import type { ReviewCommentChanges } from './comment-capabilities'

/**
 * Map the Review-comment capability fact onto the RT-001 session change vocabulary.
 * Delivery is best-effort; failures do not reverse durable writes.
 */
export function createReviewCommentChangesPublisher(
  publish: (change: SessionChange) => void,
): ReviewCommentChanges {
  return {
    publish(change) {
      publish({ kind: 'review.changed', projectPath: change.projectPath })
    },
  }
}
