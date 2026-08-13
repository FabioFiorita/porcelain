import type {
  ReviewArchiveIds,
  ReviewArchiveStore,
  ReviewClock,
  ReviewLifecycleResult,
} from './review-lifecycle-capabilities'

export type ArchiveReviewInput = { projectPath: string }

/**
 * The human's "done with this unit" path: archive the active review and clear the
 * active slots. Nothing active is a silent success, never an error.
 */
export function createArchiveReview(deps: {
  store: ReviewArchiveStore
  clock: ReviewClock
  ids: ReviewArchiveIds
}) {
  return async function archiveReview(
    input: ArchiveReviewInput,
  ): Promise<ReviewLifecycleResult<void>> {
    try {
      await deps.store.archiveActive(
        input.projectPath,
        deps.ids.create(),
        new Date(deps.clock.now()).toISOString(),
      )
      return { ok: true, value: undefined }
    } catch {
      return { ok: false, error: { code: 'review.unavailable' } }
    }
  }
}

export type ArchiveReview = ReturnType<typeof createArchiveReview>
