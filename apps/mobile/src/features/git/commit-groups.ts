import type { CommitGroupGenerationGroup } from '@porcelain/contracts'
import type { CommitGroupResult } from '@porcelain/contracts/git'

export type GroupApplyOutcome = {
  /** What the composer's status line says about the batch. */
  readonly status: { text: string; failed: boolean }
  /** The groups still worth showing — everything the daemon did not commit. */
  readonly remaining: readonly CommitGroupGenerationGroup[]
}

/** Plural agreement for the counts this surface prints. */
function groupWord(count: number): string {
  return count === 1 ? 'group' : 'groups'
}

/**
 * What a grouped-commit batch left behind.
 *
 * A partial batch is not an error to swallow: the daemon commits each group in order and
 * reports every one, so the groups that did NOT land stay on screen with the reason the batch
 * stopped. The human can then see what was committed and retry the rest, which is the whole
 * point of accepting a proposal in one tap rather than staging groups by hand.
 */
export function groupApplyOutcome(results: readonly CommitGroupResult[]): GroupApplyOutcome {
  const committed = results.filter((result) => result.status === 'committed')
  const failure = results.find((result) => result.status === 'failed')

  if (failure === undefined) {
    return {
      remaining: [],
      status: {
        failed: false,
        text: `Committed ${committed.length} ${groupWord(committed.length)}`,
      },
    }
  }

  return {
    remaining: results
      .filter((result) => result.status !== 'committed')
      .map((result) => ({ files: result.files, message: result.message })),
    status: {
      failed: true,
      text: `Committed ${committed.length} of ${results.length} groups — “${failure.message}” failed: ${failure.error ?? 'unknown error'}`,
    },
  }
}

/** The status line for a fresh proposal, before any of it is accepted. */
export function generatedGroupsStatus(count: number): string {
  return `Generated ${count} commit ${groupWord(count)}`
}
