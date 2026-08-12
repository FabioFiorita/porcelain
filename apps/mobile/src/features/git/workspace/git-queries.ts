import {
  gitBranchesQuery,
  gitHeadQuery,
  gitProjectKey,
  gitWorktreesQuery,
  worktreeInboxQuery,
} from '@porcelain/client-runtime/git'
import type { BranchRef, GitHead, Worktree } from '@porcelain/contracts/git'
import { gitProcedures } from '@porcelain/contracts/git'
import type { WorktreeInboxRow } from '@porcelain/contracts/review'
import { reviewProcedures } from '@porcelain/contracts/review'
import { keepPreviousData, type UseQueryResult, useQuery } from '@tanstack/react-query'
import { useCallback } from 'react'
import { useActiveProject } from '@/features/projects'
import { isPaired } from '@/lib/daemon/environment'
import { useActiveEnvironment } from '@/lib/daemon/environments-store'
import { namedContractProcedure } from '@/lib/daemon/procedure'

import { gitWorkspaceQueryKey } from './git-query-key'
import { callGitQuery } from './use-git-reads'

const DISABLED_PROJECT = '/__porcelain-disabled-git-workspace__'

const gitHeadProcedure = namedContractProcedure('gitHead', gitProcedures.gitHead)
const gitBranchesProcedure = namedContractProcedure('gitBranches', gitProcedures.gitBranches)
const gitWorktreesProcedure = namedContractProcedure('gitWorktrees', gitProcedures.gitWorktrees)
const worktreeInboxProcedure = namedContractProcedure(
  'worktreeInbox',
  reviewProcedures.worktreeInbox,
)

export type GitWorkspaceOptions = {
  readonly enabled?: boolean
  readonly placeholderData?: boolean
}

export type GitWorkspaceQueryResult<T> = UseQueryResult<T>

/** The four workspace reads shared by the mobile shell and Git workspace feature. */
export function useGitWorkspace(options: GitWorkspaceOptions = {}): {
  head: GitWorkspaceQueryResult<GitHead>
  branches: GitWorkspaceQueryResult<BranchRef[]>
  worktrees: GitWorkspaceQueryResult<Worktree[]>
  inbox: GitWorkspaceQueryResult<WorktreeInboxRow[]>
  refreshBranches: () => Promise<void>
} {
  const environment = useActiveEnvironment()
  const project = useActiveProject()
  const environmentId = environment?.id ?? 'none'
  const projectPath = project === null ? DISABLED_PROJECT : gitProjectKey(project.path)
  const enabled = isPaired(environment) && project !== null && (options.enabled ?? true)
  const placeholder = options.placeholderData === true ? keepPreviousData : undefined

  const head = useQuery({
    enabled,
    queryFn: async (): Promise<GitHead> => {
      if (!enabled) throw new Error('Git head query is disabled')
      return callGitQuery(environment, gitHeadProcedure, projectPath)
    },
    queryKey: gitWorkspaceQueryKey(environmentId, gitHeadQuery(projectPath)),
    refetchInterval: enabled ? 5_000 : false,
    staleTime: 0,
  })
  const branches = useQuery({
    enabled,
    placeholderData: placeholder,
    queryFn: async (): Promise<BranchRef[]> => {
      if (!enabled) throw new Error('Git branches query is disabled')
      return callGitQuery(environment, gitBranchesProcedure, projectPath)
    },
    queryKey: gitWorkspaceQueryKey(environmentId, gitBranchesQuery(projectPath)),
    staleTime: 0,
  })
  const worktrees = useQuery({
    enabled,
    placeholderData: placeholder,
    queryFn: async (): Promise<Worktree[]> => {
      if (!enabled) throw new Error('Git worktrees query is disabled')
      return callGitQuery(environment, gitWorktreesProcedure, projectPath)
    },
    queryKey: gitWorkspaceQueryKey(environmentId, gitWorktreesQuery(projectPath)),
    refetchInterval: enabled ? 15_000 : false,
  })
  const inbox = useQuery({
    enabled,
    placeholderData: placeholder,
    queryFn: async (): Promise<WorktreeInboxRow[]> => {
      if (!enabled) throw new Error('Git inbox query is disabled')
      return callGitQuery(environment, worktreeInboxProcedure, projectPath)
    },
    queryKey: gitWorkspaceQueryKey(environmentId, worktreeInboxQuery(projectPath)),
    refetchInterval: enabled ? 15_000 : false,
  })
  const refetchBranches = branches.refetch
  const refreshBranches = useCallback(async (): Promise<void> => {
    await refetchBranches()
  }, [refetchBranches])

  return { branches, head, inbox, refreshBranches, worktrees }
}
