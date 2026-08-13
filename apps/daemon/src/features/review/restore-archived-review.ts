import type {
  ReviewArchiveIds,
  ReviewArchiveStore,
  ReviewClock,
  ReviewLifecycleResult,
} from './review-lifecycle-capabilities'

export type RestoreArchivedReviewInput = { projectPath: string; id: string }

/**
 * Promote an archived review back to active. Whatever is active now is archived
 * first — with the same id and timestamp shape any other archive gets — so no
 * review is ever overwritten by a restore.
 */
export function createRestoreArchivedReview(deps: {
  store: ReviewArchiveStore
  clock: ReviewClock
  ids: ReviewArchiveIds
}) {
  return async function restoreArchivedReview(
    input: RestoreArchivedReviewInput,
  ): Promise<ReviewLifecycleResult<void>> {
    try {
      await deps.store.archiveActive(
        input.projectPath,
        deps.ids.create(),
        new Date(deps.clock.now()).toISOString(),
      )
      await deps.store.restore(input.projectPath, input.id)
      return { ok: true, value: undefined }
    } catch {
      return { ok: false, error: { code: 'review.unavailable' } }
    }
  }
}

export type RestoreArchivedReview = ReturnType<typeof createRestoreArchivedReview>
