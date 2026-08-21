import type { BranchRef, GitHead } from '@porcelain/contracts/git'
import { branchNeedsPublish } from '@porcelain/contracts/git'

/** Local and remote refs a query matched, in the two sections the picker draws. */
export type BranchMatches = {
  readonly local: readonly BranchRef[]
  readonly remote: readonly BranchRef[]
}

/** `work/foo` locally, `origin/work/foo` on a remote — the name the picker searches and shows. */
export function branchLabel(branch: BranchRef): string {
  return branch.remote === null ? branch.name : `${branch.remote}/${branch.name}`
}

/**
 * Filter the branch list the way web's switcher does: client-side, over the whole list, split
 * into Local and Remote.
 *
 * There is no paging. Even a few hundred branches narrow instantly as you type, and the daemon
 * hands over the full list in one read — a picker that paged would be asking for scroll state
 * nobody needs.
 */
export function matchBranches(branches: readonly BranchRef[], query: string): BranchMatches {
  const needle = query.trim().toLowerCase()
  const matched = branches.filter((branch) => branchLabel(branch).toLowerCase().includes(needle))
  return {
    local: matched.filter((branch) => branch.remote === null),
    remote: matched.filter((branch) => branch.remote !== null),
  }
}

export type PublishPrompt = {
  readonly title: string
  readonly body: string
}

/**
 * The first-publish warning, or null when a push needs no consent.
 *
 * A push from a branch with no matching remote does not just move commits: it creates
 * `origin/<branch>` and repoints tracking at it. That is a decision about where this work
 * lives, so it is confirmed before the command runs rather than discovered in the output.
 */
export function publishPrompt(head: GitHead | undefined): PublishPrompt | null {
  if (head === undefined || head.branch === null || !branchNeedsPublish(head)) return null
  const remote = `origin/${head.branch}`
  return {
    body:
      head.upstream === null
        ? `This branch has no remote yet. Push will create ${remote} and set it as the upstream.`
        : `This branch tracks ${head.upstream}, not a remote of the same name. Push will create ${remote} and switch tracking to it.`,
    title: `Publish ${head.branch}?`,
  }
}
