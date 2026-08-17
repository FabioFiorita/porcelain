import { createGitReviewMarks } from './git-review-marks'
import { createJsonReviewMarksStore } from './json-review-marks-store'
import { createReadReviewedPaths } from './read-reviewed-paths'
import type { ReviewMarksGit, ReviewMarksStore } from './review-marks-capabilities'
import { createSetReviewed } from './set-reviewed'

export type ReviewMarksOperations = {
  readReviewedPaths: ReturnType<typeof createReadReviewedPaths>
  setReviewed: ReturnType<typeof createSetReviewed>
}

/**
 * The reviewed-marks family. One store and one fingerprint port serve both
 * intentions, so what a write records and what a read reconciles against can never
 * come from two different derivations.
 */
export function createReviewMarksOperations(options: {
  store?: ReviewMarksStore
  git?: ReviewMarksGit
}): ReviewMarksOperations {
  const store = options.store ?? createJsonReviewMarksStore()
  const git = options.git ?? createGitReviewMarks()

  return Object.freeze({
    readReviewedPaths: createReadReviewedPaths({ store, git }),
    setReviewed: createSetReviewed({ store, git }),
  })
}
