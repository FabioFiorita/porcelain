import { readActiveIntentDocs } from '../../review/doc-set'
import type { ReviewIntent } from './review-reading-capabilities'

/**
 * Intent documents for the checkout's active review, over the same document-set
 * reader the Evidence Results sub-tab uses — one primitive owns the caps, the
 * manifest order, and the sibling inlining.
 */
export function createFsReviewIntent(): ReviewIntent {
  return Object.freeze({ readDocs: readActiveIntentDocs })
}
