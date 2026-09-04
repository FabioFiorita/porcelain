import { reviewedFingerprints } from '../../git/git'
import type { ReviewMarksGit } from './review-marks-capabilities'

/** The batched comparison fingerprint the reviewed marks are reconciled against. */
export function createGitReviewMarks(): ReviewMarksGit {
  return Object.freeze({
    fingerprints: (repoPath, paths, scope) => reviewedFingerprints(repoPath, [...paths], scope),
  })
}
