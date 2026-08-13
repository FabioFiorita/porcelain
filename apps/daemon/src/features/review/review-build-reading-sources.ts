import {
  cachedReviewReading,
  gatherReview,
  getReviewBuild,
  storeReviewReading,
} from '../../review/review-build'
import { readReviewSet } from '../../stores/review-store'
import type { ReviewReadingSources } from './review-reading-capabilities'

/**
 * The production reading sources: a thin delegation to the shared review-build
 * module, which owns the two module-level memos (one build and one reading per
 * repo path, keyed on the working-tree snapshot) and the app→agent active-review
 * snapshot write on a build miss. This adapter adds no cache of its own — a second
 * cache here would silently diverge from the key that busts the first.
 */
export function createReviewBuildReadingSources(): ReviewReadingSources {
  return Object.freeze({
    gather: (repoPath: string) => gatherReview(repoPath),
    build: (repoPath, gathered) => getReviewBuild(repoPath, gathered),
    cachedReading: (repoPath: string, key: string) => cachedReviewReading(repoPath, key),
    storeReading: (repoPath: string, key: string, reading) =>
      storeReviewReading(repoPath, key, reading),
    hasReviewSet: async (repoPath: string) => (await readReviewSet(repoPath)) !== null,
  })
}
