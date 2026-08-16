import {
  gitBranchesQuery,
  gitHeadQuery,
  gitProjectKey,
  gitWorktreesQuery,
} from '@porcelain/client-runtime/git'
import { headLabel } from '@porcelain/contracts'
import type { BranchRef, GitHead, Worktree } from '@porcelain/contracts/git'
import { useDaemonIdentity } from '@renderer/hooks/use-daemon-identity'
import { environmentClientFor } from '@renderer/lib/environment-sessions'
import { trpc } from '@renderer/lib/trpc'
import { useHubRepoPath, useHubRepoTarget } from '@renderer/stores/hub-repo'
import { useQuery } from '@tanstack/react-query'

import { gitQueryKey } from '../git-query-key'

const DISABLED_PROJECT = '/__porcelain-disabled-git-workspace__'

/** Branch refs for a specific Project, used by controls that can target a Project
 * before one of its Worktrees is selected in this window. */
export function useGitBranches(
  projectPath: string | null,
  enabled = true,
): {
  branches: BranchRef[]
  refreshBranches: () => Promise<void>
  isFetching: boolean
} {
  const daemon = useDaemonIdentity()
  const utils = trpc.useUtils()
  const target = useHubRepoTarget()
  const repoPath = useHubRepoPath()
  const owner =
    target === null && repoPath !== null
      ? { client: utils.client }
      : environmentClientFor(target?.environmentId ?? null, utils.client)
  const queryPath = projectPath === null ? DISABLED_PROJECT : gitProjectKey(projectPath)
  const query = useQuery({
    enabled: enabled && projectPath !== null && owner !== null,
    queryFn: (): Promise<BranchRef[]> => {
      if (owner === null) return Promise.reject(new Error('The target Environment is offline.'))
      return owner.client.gitBranches.query(queryPath)
    },
    queryKey: gitQueryKey(
      { host: target?.environmentId ?? daemon.host, version: daemon.version },
      gitBranchesQuery(queryPath),
    ),
    staleTime: 0,
  })

  return {
    branches: query.data ?? [],
    isFetching: query.isFetching,
    refreshBranches: async (): Promise<void> => {
      await query.refetch()
    },
  }
}

/** Workspace reads shared by the Web header, switchers, and Glance. */
export function useGitWorkspace(): {
  branch: string | undefined
  branches: BranchRef[]
  refreshBranches: () => Promise<void>
  worktrees: Worktree[]
  head: GitHead | undefined
} {
  const repoPath = useHubRepoPath()
  const target = useHubRepoTarget()
  const daemon = useDaemonIdentity()
  const utils = trpc.useUtils()
  const owner =
    target === null && repoPath !== null
      ? { client: utils.client }
      : environmentClientFor(target?.environmentId ?? null, utils.client)
  const daemonScope = { host: target?.environmentId ?? daemon.host, version: daemon.version }
  const enabled = repoPath !== null && owner !== null
  const projectPath = repoPath === null ? DISABLED_PROJECT : gitProjectKey(repoPath)

  const head = useQuery({
    enabled,
    queryFn: (): Promise<GitHead> => {
      if (owner === null) return Promise.reject(new Error('The target Environment is offline.'))
      return owner.client.gitHead.query(projectPath)
    },
    queryKey: gitQueryKey(daemonScope, gitHeadQuery(projectPath)),
    refetchInterval: enabled ? 5_000 : false,
    staleTime: 0,
  })
  const branches = useQuery({
    enabled,
    queryFn: (): Promise<BranchRef[]> => {
      if (owner === null) return Promise.reject(new Error('The target Environment is offline.'))
      return owner.client.gitBranches.query(projectPath)
    },
    queryKey: gitQueryKey(daemonScope, gitBranchesQuery(projectPath)),
    staleTime: 0,
  })
  const worktrees = useQuery({
    enabled,
    queryFn: (): Promise<Worktree[]> => {
      if (owner === null) return Promise.reject(new Error('The target Environment is offline.'))
      return owner.client.gitWorktrees.query(projectPath)
    },
    queryKey: gitQueryKey(daemonScope, gitWorktreesQuery(projectPath)),
    refetchInterval: enabled ? 15_000 : false,
  })
  const refetchBranches = branches.refetch

  return {
    branch: head.data === undefined ? undefined : headLabel(head.data),
    branches: branches.data ?? [],
    head: head.data,
    refreshBranches: async (): Promise<void> => {
      await refetchBranches()
    },
    worktrees: worktrees.data ?? [],
  }
}
