import type { FlowGroup } from '@backend/flow'
import { trpc } from '@renderer/lib/trpc'
import { useRepoStore } from '@renderer/stores/repo'

/**
 * The Changes tab's Branch scope: the flow-ordered cumulative diff since the
 * merge-base with the default branch. A committed range is static until the next
 * commit, so — unlike useGitFlow — this does NOT poll; use-commit invalidates it.
 */
export function useBranchFlow(enabled: boolean): {
  groups: FlowGroup[] | undefined
  base: string | undefined
  refresh: () => Promise<void>
} {
  const repo = useRepoStore((s) => s.repo)
  const { data, refetch } = trpc.gitRangeFlow.useQuery(repo?.path ?? '', {
    enabled: enabled && repo !== null,
    staleTime: Number.POSITIVE_INFINITY,
  })
  const refresh = async (): Promise<void> => {
    await refetch()
  }
  return { groups: data?.groups, base: data?.base, refresh }
}
