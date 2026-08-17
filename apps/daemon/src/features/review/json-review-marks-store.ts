import {
  readReviewedMarks,
  removeReviewedMarks,
  setReviewedMarks,
} from '../../stores/reviewed-store'
import type { ReviewedMark, ReviewMarksStore } from './review-marks-capabilities'

/**
 * `reviewed.json` as the marks store. The project channel underneath owns the schema,
 * the atomic write, and the "absent file is an empty set" rule; this adapter only
 * narrows it to the three intentions the feature needs.
 */
export function createJsonReviewMarksStore(): ReviewMarksStore {
  return Object.freeze({
    read: (repoPath: string): Promise<ReviewedMark[]> => readReviewedMarks(repoPath),

    write: (repoPath: string, marks: readonly ReviewedMark[]): Promise<void> =>
      setReviewedMarks(repoPath, [...marks]),

    remove: (repoPath: string, marks: readonly ReviewedMark[]): Promise<void> =>
      removeReviewedMarks(repoPath, marks),
  })
}
