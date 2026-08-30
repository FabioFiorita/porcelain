import {
  gitBranchesQuery,
  gitHeadQuery,
  gitProjectKey,
  gitWorktreesQuery,
} from '@porcelain/client-runtime/git'
import type { BranchRef, GitHead, Worktree } from '@porcelain/contracts/git'
import { gitProcedures } from '@porcelain/contracts/git'
import { keepPreviousData, type UseQueryResult, useQuery } from '@tanstack/react-query'
import { useCallback } from 'react'
import { useHubRepoPath } from '@/features/projects'
import { isPaired, useActiveEnvironment } from '@/features/remote'
import { namedContractProcedure } from '@/lib/daemon/procedure'

import { gitQueryKey } from '../git-query-key'
import { callGit, DISABLED_PROJECT } from '../use-git-transport'

const gitHeadProcedure = namedContractProcedure('gitHead', gitProcedures.gitHead)
const gitBranchesProcedure = namedContractProcedure('gitBranches', gitProcedures.gitBranches)
const gitWorktreesProcedure = namedContractProcedure('gitWorktrees', gitProcedures.gitWorktrees)

export type GitWorkspaceOptions = {
  readonly enabled?: boolean
  readonly placeholderData?: boolean
}

export type GitWorkspaceQueryResult<T> = UseQueryResult<T>

/** Workspace reads shared by the mobile shell and Git workspace feature. */
export function useGitWorkspace(options: GitWorkspaceOptions = {}): {
  head: GitWorkspaceQueryResult<GitHead>
  branches: GitWorkspaceQueryResult<BranchRef[]>
  worktrees: GitWorkspaceQueryResult<Worktree[]>
  refreshBranches: () => Promise<void>
} {
  const environment = useActiveEnvironment()
  const repoPath = useHubRepoPath()
  const environmentId = environment?.id ?? 'none'
  const projectPath = repoPath === null ? DISABLED_PROJECT : gitProjectKey(repoPath)
  const enabled = isPaired(environment) && repoPath !== null && (options.enabled ?? true)
  // Workspace pickers pass their own open/focus state. A bare read is allowed, but it is not a
  // surface that may retain a polling interval.
  const pollingEnabled = options.enabled === true
  const placeholder = options.placeholderData === true ? keepPreviousData : undefined

  const head = useQuery({
    enabled,
    queryFn: async (): Promise<GitHead> => {
      if (!enabled) throw new Error('Git head query is disabled')
      return callGit(environment, gitHeadProcedure, projectPath)
    },
    queryKey: gitQueryKey(environmentId, gitHeadQuery(projectPath)),
    refetchInterval: enabled && pollingEnabled ? 5_000 : false,
    refetchIntervalInBackground: false,
    staleTime: 0,
  })
  const branches = useQuery({
    enabled,
    placeholderData: placeholder,
    queryFn: async (): Promise<BranchRef[]> => {
      if (!enabled) throw new Error('Git branches query is disabled')
      return callGit(environment, gitBranchesProcedure, projectPath)
    },
    queryKey: gitQueryKey(environmentId, gitBranchesQuery(projectPath)),
    staleTime: 0,
  })
  const worktrees = useQuery({
    enabled,
    placeholderData: placeholder,
    queryFn: async (): Promise<Worktree[]> => {
      if (!enabled) throw new Error('Git worktrees query is disabled')
      return callGit(environment, gitWorktreesProcedure, projectPath)
    },
    queryKey: gitQueryKey(environmentId, gitWorktreesQuery(projectPath)),
    refetchInterval: enabled && pollingEnabled ? 15_000 : false,
    refetchIntervalInBackground: false,
  })
  const refetchBranches = branches.refetch
  const refreshBranches = useCallback(async (): Promise<void> => {
    await refetchBranches()
  }, [refetchBranches])

  return { branches, head, refreshBranches, worktrees }
}
