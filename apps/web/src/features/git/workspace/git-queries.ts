import {
  gitBranchesQuery,
  gitHeadQuery,
  gitProjectKey,
  gitWorktreesQuery,
} from '@porcelain/client-runtime/git'
import { reviewInboxQuery } from '@porcelain/client-runtime/review'
import { headLabel } from '@porcelain/contracts'
import type { BranchRef, GitHead, Worktree } from '@porcelain/contracts/git'
import type { ReviewInboxRow } from '@porcelain/contracts/review'
import { useDaemonIdentity } from '@renderer/hooks/use-daemon-identity'
import { trpc } from '@renderer/lib/trpc'
import { useProjectSelectionStore } from '@renderer/stores/project-selection'
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
  const queryPath = projectPath === null ? DISABLED_PROJECT : gitProjectKey(projectPath)
  const query = useQuery({
    enabled: enabled && projectPath !== null,
    queryFn: (): Promise<BranchRef[]> => utils.client.gitBranches.query(queryPath),
    queryKey: gitQueryKey(
      { host: daemon.host, version: daemon.version },
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

/** The four workspace reads shared by the Web header, switchers, inbox, and Glance. */
export function useGitWorkspace(): {
  branch: string | undefined
  branches: BranchRef[]
  refreshBranches: () => Promise<void>
  worktrees: Worktree[]
  inbox: ReviewInboxRow[]
  head: GitHead | undefined
} {
  const project = useProjectSelectionStore((state) => state.project)
  const daemon = useDaemonIdentity()
  const daemonScope = { host: daemon.host, version: daemon.version }
  const utils = trpc.useUtils()
  const enabled = project !== null
  const projectPath = project === null ? DISABLED_PROJECT : gitProjectKey(project.path)

  const head = useQuery({
    enabled,
    queryFn: (): Promise<GitHead> => utils.client.gitHead.query(projectPath),
    queryKey: gitQueryKey(daemonScope, gitHeadQuery(projectPath)),
    refetchInterval: enabled ? 5_000 : false,
    staleTime: 0,
  })
  const branches = useQuery({
    enabled,
    queryFn: (): Promise<BranchRef[]> => utils.client.gitBranches.query(projectPath),
    queryKey: gitQueryKey(daemonScope, gitBranchesQuery(projectPath)),
    staleTime: 0,
  })
  const worktrees = useQuery({
    enabled,
    queryFn: (): Promise<Worktree[]> => utils.client.gitWorktrees.query(projectPath),
    queryKey: gitQueryKey(daemonScope, gitWorktreesQuery(projectPath)),
    refetchInterval: enabled ? 15_000 : false,
  })
  const inbox = useQuery({
    enabled,
    queryFn: (): Promise<ReviewInboxRow[]> => utils.client.reviewInbox.query(projectPath),
    queryKey: gitQueryKey(daemonScope, reviewInboxQuery(projectPath)),
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
