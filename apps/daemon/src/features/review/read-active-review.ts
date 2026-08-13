import type { ActiveReview } from '../../review/active-review'
import type { ReviewReadingSources } from './review-reading-capabilities'

/**
 * The active review's Execution outline: exactly the files the agent listed in the
 * review set (porcelain CLI → `<repo>/.porcelain/review.json`), in agent order,
 * with notes/layers/thesis/sections. `null` without a set — the renderer's "No
 * review yet" empty state, never an empty view. Working-tree changes the agent did
 * not list never appear here.
 */
export function createReadActiveReview(deps: { sources: ReviewReadingSources }) {
  return async ({ projectPath }: { projectPath: string }): Promise<ActiveReview | null> => {
    const gathered = await deps.sources.gather(projectPath)
    if (!gathered.reviewSet) return null
    return (await deps.sources.build(projectPath, { ...gathered, reviewSet: gathered.reviewSet }))
      .view
  }
}
