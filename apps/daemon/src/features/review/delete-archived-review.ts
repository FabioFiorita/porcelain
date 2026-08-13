import type { ReviewArchiveStore, ReviewLifecycleResult } from './review-lifecycle-capabilities'

export type DeleteArchivedReviewInput = { projectPath: string; id: string }

/** Permanently delete an archived review. */
export function createDeleteArchivedReview(deps: { store: ReviewArchiveStore }) {
  return async function deleteArchivedReview(
    input: DeleteArchivedReviewInput,
  ): Promise<ReviewLifecycleResult<void>> {
    try {
      await deps.store.remove(input.projectPath, input.id)
      return { ok: true, value: undefined }
    } catch {
      return { ok: false, error: { code: 'review.unavailable' } }
    }
  }
}

export type DeleteArchivedReview = ReturnType<typeof createDeleteArchivedReview>
