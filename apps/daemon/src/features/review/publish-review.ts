import type {
  ReviewArchiveIds,
  ReviewArchiveStore,
  ReviewClock,
  ReviewLifecycleResult,
  ReviewPublication,
  ReviewPublishOutcome,
} from './review-lifecycle-capabilities'

export type PublishReviewInput = { projectPath: string }

/**
 * Archive the active review and stage it for the team. Reviews are Local by
 * default, so publication force-stages — the one place in the app that does, and
 * only because the human just asked for exactly this path. The cost is measured
 * before anything moves, so the warning the human saw is the review they publish.
 */
export function createPublishReview(deps: {
  store: ReviewArchiveStore
  publication: ReviewPublication
  clock: ReviewClock
  ids: ReviewArchiveIds
}) {
  return async function publishReview(
    input: PublishReviewInput,
  ): Promise<ReviewLifecycleResult<ReviewPublishOutcome | null>> {
    try {
      const cost = await deps.store.activeCost(input.projectPath)
      const id = await deps.store.archiveActive(
        input.projectPath,
        deps.ids.create(),
        new Date(deps.clock.now()).toISOString(),
      )
      if (id === null) return { ok: true, value: null }

      await deps.publication.recordPublished(input.projectPath, id)
      await deps.publication.forceStage(
        input.projectPath,
        deps.store.archiveRelativePath(input.projectPath, id),
      )
      return { ok: true, value: { id, cost } }
    } catch {
      return { ok: false, error: { code: 'review.unavailable' } }
    }
  }
}

export type PublishReview = ReturnType<typeof createPublishReview>
