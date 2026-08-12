import type { FlowGroup } from '@backend/review/flow'
import { trpc } from '@renderer/lib/trpc'
import { useProjectSelectionStore } from '@renderer/stores/project-selection'

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
  const project = useProjectSelectionStore((s) => s.project)
  const { data, refetch } = trpc.gitRangeFlow.useQuery(project?.path ?? '', {
    enabled: enabled && project !== null,
    staleTime: Number.POSITIVE_INFINITY,
  })
  const refresh = async (): Promise<void> => {
    await refetch()
  }
  return { groups: data?.groups, base: data?.base, refresh }
}
