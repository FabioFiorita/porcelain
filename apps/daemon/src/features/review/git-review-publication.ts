import { gitForceStage } from '../../git/git'
import { recordPublishedReview } from '../project-data'
import type { ReviewPublication } from './review-lifecycle-capabilities'

/**
 * Publishing a review is the one place in the app that force-stages past
 * `.gitignore`, and the only Review path that reaches Git or Project Data. It
 * stages and stops: what goes in a commit stays the human's call.
 */
export function createGitReviewPublication(): ReviewPublication {
  return Object.freeze({
    // The durable half: a negation rule the team can read, which travels with the
    // commit and lifts the clone-wide exclude, without which the stage is inert.
    recordPublished: (repoPath: string, id: string) => recordPublishedReview(repoPath, id),
    // The immediate half: stage it now so the human sees it in Changes.
    forceStage: (repoPath: string, relativePath: string) => gitForceStage(repoPath, relativePath),
  })
}
