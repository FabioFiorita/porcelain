import type { FlowGroup } from '@main/flow'
import { trpc } from '@renderer/lib/trpc'
import { useRepoStore } from '@renderer/stores/repo'

export function useGitFlow(): { groups: FlowGroup[] | undefined; refresh: () => Promise<void> } {
  const repo = useRepoStore((s) => s.repo)
  const utils = trpc.useUtils()
  const { data: groups, refetch } = trpc.gitFlow.useQuery(repo?.path ?? '', {
    enabled: repo !== null,
    // working-tree state changes outside the app constantly; keep it live
    staleTime: 0,
    refetchInterval: 3000,
  })

  const refresh = async (): Promise<void> => {
    await Promise.all([refetch(), utils.gitDiffFile.invalidate()])
  }

  return { groups, refresh }
}
