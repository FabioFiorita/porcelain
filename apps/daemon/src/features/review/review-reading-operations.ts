import { createExploreReview } from './explore-review'
import { createFeatureBuildReadingSources } from './feature-build-reading-sources'
import { createFsReviewEvidenceSummary } from './fs-review-evidence-summary'
import { createFsReviewSourceFiles } from './fs-review-source-files'
import { createGitReviewReading } from './git-review-reading'
import { createListReviewInbox } from './list-review-inbox'
import { createReadActiveReview } from './read-active-review'
import { createReadReviewReading } from './read-review-reading'
import type {
  ReviewEvidence,
  ReviewFiles,
  ReviewGit,
  ReviewReadingSources,
} from './review-reading-capabilities'

export type ReviewReadingOperations = {
  readActiveReview: ReturnType<typeof createReadActiveReview>
  readReviewReading: ReturnType<typeof createReadReviewReading>
  exploreReview: ReturnType<typeof createExploreReview>
  listReviewInbox: ReturnType<typeof createListReviewInbox>
}

/**
 * The Review reading family. `sources` is shared by the two reading intentions and
 * the inbox on purpose: it is the one place the build memo and the review-set probe
 * live, so a second construction would mean a second cache.
 */
export function createReviewReadingOperations(options: {
  sources?: ReviewReadingSources
  git?: ReviewGit
  files?: ReviewFiles
  evidence?: ReviewEvidence
}): ReviewReadingOperations {
  const sources = options.sources ?? createFeatureBuildReadingSources()
  const git = options.git ?? createGitReviewReading()
  const files = options.files ?? createFsReviewSourceFiles()
  const evidence = options.evidence ?? createFsReviewEvidenceSummary()

  return Object.freeze({
    readActiveReview: createReadActiveReview({ sources }),
    readReviewReading: createReadReviewReading({ sources, git, evidence }),
    exploreReview: createExploreReview({ git, files }),
    listReviewInbox: createListReviewInbox({ git, sources }),
  })
}
