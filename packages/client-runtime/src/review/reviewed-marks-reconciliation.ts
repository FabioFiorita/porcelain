import type {
  MarkReviewedInput,
  SetReviewedInput,
  UnmarkReviewedInput,
} from '@porcelain/contracts/review'

/**
 * Pure reviewed-marks optimistic transitions and rollback (REV-006).
 *
 * The `comment-reconciliation.ts` idiom without temporary ids: the daemon assigns nothing
 * here, so a mark is instant, exactly reversible, and still followed by the authoritative
 * refetch its mutation definition declares. No ambient clock, no id generator, no cache.
 */

/** Exact pre-mutation reviewed-path list for rollback. */
export type ReviewedMarksSnapshot = {
  readonly paths: readonly string[]
}

export type ReviewedMarksMutationKey = 'markReviewed' | 'unmarkReviewed' | 'setReviewed'

type ReviewedMarksInputByKey = {
  markReviewed: MarkReviewedInput
  unmarkReviewed: UnmarkReviewedInput
  setReviewed: SetReviewedInput
}

/**
 * Apply a pure reviewed-marks transition. An absent previous list reads as empty, marking
 * is idempotent and preserves first-seen order, and the input array is never mutated.
 */
export function applyReviewedMarksTransition<K extends ReviewedMarksMutationKey>(
  key: K,
  previous: readonly string[] | undefined,
  input: ReviewedMarksInputByKey[K],
): readonly string[] {
  const paths = previous ?? []
  switch (key) {
    case 'markReviewed': {
      const markInput = input as MarkReviewedInput
      if (paths.includes(markInput.path)) return paths.slice()
      return [...paths, markInput.path]
    }
    case 'unmarkReviewed': {
      const unmarkInput = input as UnmarkReviewedInput
      return paths.filter((path) => path !== unmarkInput.path)
    }
    case 'setReviewed': {
      const setInput = input as SetReviewedInput
      return setInput.paths.slice()
    }
    default: {
      const _exhaustive: never = key
      return _exhaustive
    }
  }
}

/** Restore the exact pre-mutation reviewed-path list. */
export function rollbackReviewedMarksTransition(
  snapshot: ReviewedMarksSnapshot,
): readonly string[] {
  return snapshot.paths
}
