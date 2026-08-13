import type {
  ReviewArchiveStore,
  ReviewLifecycleResult,
  ReviewPublishCost,
} from './review-lifecycle-capabilities'

export type ReadPublishCostInput = { projectPath: string }

/**
 * What publishing the active review would add to git history, measured before the
 * human commits to it. Evidence packs are the reason this exists: a 30 MB capture
 * inside a review is worth knowing about first, because history does not forget.
 */
export function createPublishCost(deps: { store: ReviewArchiveStore }) {
  return async function publishCost(
    input: ReadPublishCostInput,
  ): Promise<ReviewLifecycleResult<ReviewPublishCost>> {
    try {
      return { ok: true, value: await deps.store.activeCost(input.projectPath) }
    } catch {
      return { ok: false, error: { code: 'review.unavailable' } }
    }
  }
}

export type PublishCost = ReturnType<typeof createPublishCost>
