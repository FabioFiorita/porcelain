import { randomBytes } from 'node:crypto'
import { createArchiveReview } from './archive-review'
import { createDeleteArchivedReview } from './delete-archived-review'
import { createFsReviewArchiveStore } from './fs-review-archive-store'
import { createGitReviewPublication } from './git-review-publication'
import { createArchivedReviews } from './list-archived-reviews'
import { createPublishReview } from './publish-review'
import { createPublishCost } from './read-publish-cost'
import { createRestoreArchivedReview } from './restore-archived-review'
import type {
  ReviewArchiveIds,
  ReviewArchiveStore,
  ReviewClock,
  ReviewPublication,
} from './review-lifecycle-capabilities'

export type ReviewLifecycleOperations = {
  archiveReview: ReturnType<typeof createArchiveReview>
  publishReview: ReturnType<typeof createPublishReview>
  publishCost: ReturnType<typeof createPublishCost>
  archivedReviews: ReturnType<typeof createArchivedReviews>
  restoreArchivedReview: ReturnType<typeof createRestoreArchivedReview>
  deleteArchivedReview: ReturnType<typeof createDeleteArchivedReview>
}

/** `<base36 millis>-<8 hex chars>`: sortable, and unique inside one millisecond. */
function newArchiveId(): string {
  return `${Date.now().toString(36)}-${randomBytes(4).toString('hex')}`
}

export function createReviewLifecycleOperations(options: {
  store?: ReviewArchiveStore
  publication?: ReviewPublication
  clock?: ReviewClock
  ids?: ReviewArchiveIds
}): ReviewLifecycleOperations {
  const store = options.store ?? createFsReviewArchiveStore()
  const publication = options.publication ?? createGitReviewPublication()
  const clock = options.clock ?? { now: () => Date.now() }
  const ids = options.ids ?? { create: newArchiveId }

  return Object.freeze({
    archiveReview: createArchiveReview({ store, clock, ids }),
    publishReview: createPublishReview({ store, publication, clock, ids }),
    publishCost: createPublishCost({ store }),
    archivedReviews: createArchivedReviews({ store }),
    restoreArchivedReview: createRestoreArchivedReview({ store, clock, ids }),
    deleteArchivedReview: createDeleteArchivedReview({ store }),
  })
}
