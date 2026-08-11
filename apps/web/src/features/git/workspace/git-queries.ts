import {
  gitBranchesQuery,
  gitHeadQuery,
  gitProjectKey,
  gitWorktreesQuery,
  worktreeInboxQuery,
} from '@porcelain/client-runtime/git'
import { headLabel } from '@porcelain/contracts'
import type { BranchRef, GitHead, Worktree } from '@porcelain/contracts/git'
import type { WorktreeInboxRow } from '@porcelain/contracts/review'
import { useDaemonIdentity } from '@renderer/hooks/use-daemon-identity'
import { trpc } from '@renderer/lib/trpc'
import { useRepoStore } from '@renderer/stores/repo'
import { useQuery } from '@tanstack/react-query'

import { gitWorkspaceQueryKey } from './git-query-key'

const DISABLED_PROJECT = '/__porcelain-disabled-git-workspace__'

/** The four workspace reads shared by the Web header, switchers, inbox, and Glance. */
export function useGitWorkspace(): {
  branch: string | undefined
  branches: BranchRef[]
  refreshBranches: () => Promise<void>
  worktrees: Worktree[]
  inbox: WorktreeInboxRow[]
  head: GitHead | undefined
} {
  const repo = useRepoStore((state) => state.repo)
  const daemon = useDaemonIdentity()
  const daemonScope = { host: daemon.host, version: daemon.version }
  const utils = trpc.useUtils()
  const enabled = repo !== null
  const projectPath = repo === null ? DISABLED_PROJECT : gitProjectKey(repo.path)

  const head = useQuery({
    enabled,
    queryFn: (): Promise<GitHead> => utils.client.gitHead.query(projectPath),
    queryKey: gitWorkspaceQueryKey(daemonScope, gitHeadQuery(projectPath)),
    refetchInterval: enabled ? 5_000 : false,
    staleTime: 0,
  })
  const branches = useQuery({
    enabled,
    queryFn: (): Promise<BranchRef[]> => utils.client.gitBranches.query(projectPath),
    queryKey: gitWorkspaceQueryKey(daemonScope, gitBranchesQuery(projectPath)),
    staleTime: 0,
  })
  const worktrees = useQuery({
    enabled,
    queryFn: (): Promise<Worktree[]> => utils.client.gitWorktrees.query(projectPath),
    queryKey: gitWorkspaceQueryKey(daemonScope, gitWorktreesQuery(projectPath)),
    refetchInterval: enabled ? 15_000 : false,
  })
  const inbox = useQuery({
    enabled,
    queryFn: (): Promise<WorktreeInboxRow[]> => utils.client.worktreeInbox.query(projectPath),
    queryKey: gitWorkspaceQueryKey(daemonScope, worktreeInboxQuery(projectPath)),
    refetchInterval: enabled ? 15_000 : false,
  })
  const refetchBranches = branches.refetch

  return {
    branch: head.data === undefined ? undefined : headLabel(head.data),
    branches: branches.data ?? [],
    head: head.data,
    inbox: inbox.data ?? [],
    refreshBranches: async (): Promise<void> => {
      await refetchBranches()
    },
    worktrees: worktrees.data ?? [],
  }
}
