import type { HubWorktree } from '@porcelain/contracts/projects'

import { type Environment, environmentActions } from '@/features/remote'

/**
 * Open a Worktree from the Hub list.
 *
 * The whole app reads its checkout synchronously off the active Environment record
 * (`useHubRepoPath`), so opening a Worktree is a WRITE, not a navigation: the Environment that
 * owns it becomes active and its `activeRepoPath` becomes that checkout. Pushing the Worktree
 * screen without this would leave every surface pointed at whatever was selected before —
 * populated, plausible, and wrong.
 */
export async function openHubWorktree(
  environment: Environment,
  worktree: HubWorktree,
): Promise<void> {
  await environmentActions.setActive(environment.id)
  await environmentActions.setActiveProjectPath(environment.id, worktree.path)
}
