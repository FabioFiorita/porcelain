import type { SetReviewedInput } from '@porcelain/contracts/review'

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

export type ReviewedMarksMutationKey = 'setReviewed'

type ReviewedMarksInputByKey = {
  setReviewed: SetReviewedInput
}

/**
 * Apply a pure reviewed-marks transition, mirroring the total `setReviewed` write: the
 * named paths take the named state and every other mark is left alone. An absent previous
 * list reads as empty, the transition is idempotent and preserves first-seen order, and
 * the input array is never mutated.
 */
export function applyReviewedMarksTransition<K extends ReviewedMarksMutationKey>(
  key: K,
  previous: readonly string[] | undefined,
  input: ReviewedMarksInputByKey[K],
): readonly string[] {
  const paths = previous ?? []
  switch (key) {
    case 'setReviewed': {
      if (!input.reviewed) {
        const dropped = new Set(input.paths)
        return paths.filter((path) => !dropped.has(path))
      }
      const added = input.paths.filter((path) => !paths.includes(path))
      return [...paths, ...new Set(added)]
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
