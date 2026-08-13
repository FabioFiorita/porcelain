import {
  cachedFeatureReading,
  gatherFeature,
  getFeatureBuild,
  storeFeatureReading,
} from '../../review/feature-build'
import { readReviewSet } from '../../stores/review-store'
import type { ReviewReadingSources } from './review-reading-capabilities'

/**
 * The production reading sources: a thin delegation to the shared feature-build
 * module, which owns the two module-level memos (one build and one reading per
 * repo path, keyed on the working-tree snapshot) and the app→agent feature
 * snapshot write on a build miss. This adapter adds no cache of its own — a second
 * cache here would silently diverge from the key that busts the first.
 */
export function createFeatureBuildReadingSources(): ReviewReadingSources {
  return Object.freeze({
    gather: (repoPath: string) => gatherFeature(repoPath),
    build: (repoPath, gathered) => getFeatureBuild(repoPath, gathered),
    cachedReading: (repoPath: string, key: string) => cachedFeatureReading(repoPath, key),
    storeReading: (repoPath: string, key: string, reading) =>
      storeFeatureReading(repoPath, key, reading),
    hasReviewSet: async (repoPath: string) => (await readReviewSet(repoPath)) !== null,
  })
}
