import { reviewedFingerprints } from '../../git/git'
import type { ReviewMarksGit } from './review-marks-capabilities'

/** The batched `git diff` fingerprint the reviewed marks are reconciled against. */
export function createGitReviewMarks(): ReviewMarksGit {
  return Object.freeze({
    fingerprints: (repoPath: string, paths: readonly string[]): Promise<Map<string, string>> =>
      reviewedFingerprints(repoPath, [...paths]),
  })
}
