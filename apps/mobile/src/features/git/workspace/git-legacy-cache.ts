import type { GitWorkspaceQuery } from '@porcelain/client-runtime/git'
import type { gitProcedures } from '@porcelain/contracts/git'
import type { reviewProcedures } from '@porcelain/contracts/review'
import type { QueryClient } from '@tanstack/react-query'

import { invalidateGitWorkspaceEffects } from './git-query-filter'

type LegacyProcedureName = keyof typeof gitProcedures | keyof typeof reviewProcedures

/** Canonical wire names for the reads GIT-006 will later move to semantic keys. */
const LEGACY_PROCEDURES = {
  branches: 'gitBranches',
  'commit-conventions': 'gitCommitConventions',
  diff: 'gitDiffFile',
  flow: 'gitFlow',
  head: 'gitHead',
  log: 'gitLog',
  'range-flow': 'gitRangeFlow',
  reading: 'featureReading',
  'reviewed-paths': 'reviewedPaths',
  status: 'gitStatus',
  suggestions: 'gitSuggestions',
  view: 'featureView',
  worktrees: 'gitWorktrees',
  'worktree-inbox': 'worktreeInbox',
} as const satisfies Record<GitWorkspaceQuery['name'], LegacyProcedureName>

function legacyInputMatchesProject(input: unknown, projectPath: string): boolean {
  if (input === projectPath) return true
  if (typeof input !== 'object' || input === null) return false
  if ('repoPath' in input && input.repoPath === projectPath) return true
  return 'projectPath' in input && input.projectPath === projectPath
}

/** Project/environment matcher for the pre-GIT-006 mobile daemon keys. */
export function legacyGitQueryMatchesEffect(
  queryKey: readonly unknown[],
  effect: GitWorkspaceQuery,
  environmentId: string,
): boolean {
  if (queryKey[0] !== 'daemon' || queryKey[1] !== environmentId) return false
  if (queryKey[2] !== LEGACY_PROCEDURES[effect.name]) return false
  return legacyInputMatchesProject(queryKey[3], effect.projectPath)
}

/** Apply semantic keys and the bounded legacy cache bridge for one exact effect set. */
export async function invalidateGitEffects(
  queryClient: QueryClient,
  environmentId: string,
  effects: readonly GitWorkspaceQuery[],
): Promise<void> {
  await invalidateGitWorkspaceEffects(queryClient, environmentId, effects)
  await Promise.all(
    effects.map((effect) =>
      queryClient.invalidateQueries({
        predicate: (query) => legacyGitQueryMatchesEffect(query.queryKey, effect, environmentId),
      }),
    ),
  )
}
