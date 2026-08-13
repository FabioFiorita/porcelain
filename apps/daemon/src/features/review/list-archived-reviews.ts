import type {
  ArchivedReviewMeta,
  ReviewArchiveStore,
  ReviewLifecycleResult,
} from './review-lifecycle-capabilities'

export type ListArchivedReviewsInput = { projectPath: string }

/** Previous (archived) reviews for the project, newest first. */
export function createArchivedReviews(deps: { store: ReviewArchiveStore }) {
  return async function archivedReviews(
    input: ListArchivedReviewsInput,
  ): Promise<ReviewLifecycleResult<ArchivedReviewMeta[]>> {
    try {
      return { ok: true, value: await deps.store.list(input.projectPath) }
    } catch {
      return { ok: false, error: { code: 'review.unavailable' } }
    }
  }
}

export type ArchivedReviews = ReturnType<typeof createArchivedReviews>
