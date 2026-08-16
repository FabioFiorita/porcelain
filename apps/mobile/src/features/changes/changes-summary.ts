import type { FlowGroup } from '@porcelain/contracts/git'

/** Header counts for a change set, and the sentence the Changes header prints. */
export type ChangesSummary = {
  total: number
  label: string
}

/**
 * Summarize a flow-grouped change set the way the web header does: the running
 * "N changed files · vs base · N reviewed" line, which collapses into a completion
 * sentence once the whole set has been read.
 */
export function summarizeChanges(groups: readonly FlowGroup[], base?: string): ChangesSummary {
  let total = 0
  for (const group of groups) {
    for (const _file of group.files) {
      total += 1
    }
  }
  const noun = total === 1 ? 'file' : 'files'
  const vs = base === undefined ? '' : ` · vs ${base}`
  return {
    label: `${total} changed ${noun}${vs}`,
    total,
  }
}

/** Every path in the change set, in flow order — the input to the bulk reviewed toggle. */
