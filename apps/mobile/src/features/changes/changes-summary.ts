import type { FlowGroup } from '@/lib/daemon/procedures/changes'

/** Header counts for a change set, and the sentence the Changes header prints. */
export type ChangesSummary = {
  total: number
  reviewedCount: number
  /** True only when there is something to review AND every file of it is ticked. */
  allReviewed: boolean
  label: string
}

/**
 * Summarize a flow-grouped change set the way the web header does: the running
 * "N changed files · vs base · N reviewed" line, which collapses into a completion
 * sentence once the whole set has been read.
 */
export function summarizeChanges(
  groups: readonly FlowGroup[],
  reviewed: ReadonlySet<string>,
  base?: string,
): ChangesSummary {
  let total = 0
  let reviewedCount = 0
  for (const group of groups) {
    for (const file of group.files) {
      total += 1
      if (reviewed.has(file.path)) reviewedCount += 1
    }
  }
  const allReviewed = total > 0 && reviewedCount === total
  const noun = total === 1 ? 'file' : 'files'
  const vs = base === undefined ? '' : ` · vs ${base}`
  return {
    allReviewed,
    label: allReviewed
      ? `All ${total} ${noun} reviewed${vs}`
      : `${total} changed ${noun}${vs}${reviewedCount > 0 ? ` · ${reviewedCount} reviewed` : ''}`,
    reviewedCount,
    total,
  }
}

/** Every path in the change set, in flow order — the input to the bulk reviewed toggle. */
export function changedPaths(groups: readonly FlowGroup[]): string[] {
  return groups.flatMap((group) => group.files.map((file) => file.path))
}
