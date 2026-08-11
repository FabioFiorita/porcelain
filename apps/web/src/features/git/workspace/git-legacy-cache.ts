import type { GitWorkspaceQuery } from '@porcelain/client-runtime/git'
import type { DaemonScope } from '@renderer/lib/daemon-scope'
import type { QueryClient } from '@tanstack/react-query'
import { invalidateGitWorkspaceEffects } from './git-query-filter'

type GitInvalidator<TInput> = {
  invalidate: (input?: TInput) => Promise<unknown>
}

export type GitLegacyUtils = {
  gitHead: GitInvalidator<string>
  gitFlow: GitInvalidator<string>
  gitRangeFlow: GitInvalidator<string>
  gitStatus: GitInvalidator<string>
  gitDiffFile: GitInvalidator<{ repoPath: string }>
  gitBranches: GitInvalidator<string>
  gitWorktrees: GitInvalidator<string>
  gitLog: GitInvalidator<{ repoPath: string }>
  gitCommitConventions: GitInvalidator<string>
  gitSuggestions: GitInvalidator<string>
  featureReading: GitInvalidator<string>
  featureView: GitInvalidator<string>
  reviewedPaths: GitInvalidator<string>
  worktreeInbox: GitInvalidator<string>
}

/**
 * Bind GIT-003 semantics to the still-legacy reads that GIT-006 will migrate. This is an
 * explicit project-scoped adapter, never the broad tRPC flush that preceded GIT-004.
 */
function invalidateLegacyEffect(
  utils: GitLegacyUtils,
  effect: GitWorkspaceQuery,
): Promise<unknown> {
  switch (effect.name) {
    case 'head':
      return utils.gitHead.invalidate(effect.projectPath)
    case 'flow':
      return utils.gitFlow.invalidate(effect.projectPath)
    case 'range-flow':
      return utils.gitRangeFlow.invalidate(effect.projectPath)
    case 'status':
      return utils.gitStatus.invalidate(effect.projectPath)
    case 'diff':
      return utils.gitDiffFile.invalidate({ repoPath: effect.projectPath })
    case 'branches':
      return utils.gitBranches.invalidate(effect.projectPath)
    case 'worktrees':
      return utils.gitWorktrees.invalidate(effect.projectPath)
    case 'log':
      return utils.gitLog.invalidate({ repoPath: effect.projectPath })
    case 'commit-conventions':
      return utils.gitCommitConventions.invalidate(effect.projectPath)
    case 'suggestions':
      return utils.gitSuggestions.invalidate(effect.projectPath)
    case 'reading':
      return utils.featureReading.invalidate(effect.projectPath)
    case 'view':
      return utils.featureView.invalidate(effect.projectPath)
    case 'reviewed-paths':
      return utils.reviewedPaths.invalidate(effect.projectPath)
    case 'worktree-inbox':
      return utils.worktreeInbox.invalidate(effect.projectPath)
    default: {
      const _exhaustive: never = effect
      return _exhaustive
    }
  }
}

/** Apply semantic keys and the bounded legacy cache bridge for one exact effect set. */
export async function invalidateGitEffects(
  queryClient: QueryClient,
  daemon: DaemonScope,
  utils: GitLegacyUtils,
  effects: readonly GitWorkspaceQuery[],
): Promise<void> {
  await invalidateGitWorkspaceEffects(queryClient, daemon, effects)
  await Promise.all(effects.map((effect) => invalidateLegacyEffect(utils, effect)))
}
