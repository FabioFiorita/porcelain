import type { ChangedFile, DiffStat } from './diff'
import type { Layer } from './flow'
import type { ReviewSet } from './review-set'

/** Cache key for the flow view: any change to status, numstat, or layers busts it. */
export function flowKey(
  files: readonly ChangedFile[],
  stats: readonly DiffStat[],
  layers: readonly Layer[],
): string {
  return JSON.stringify([files, stats, layers])
}

/** Cache key for the feature view/reading: the flow inputs PLUS the agent review set. */
export function featureKey(
  files: readonly ChangedFile[],
  stats: readonly DiffStat[],
  layers: readonly Layer[],
  reviewSet: ReviewSet | null,
): string {
  return JSON.stringify([files, stats, layers, reviewSet])
}
