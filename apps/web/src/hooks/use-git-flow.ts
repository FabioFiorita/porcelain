import type { FlowGroup } from '@backend/review/flow'
import type { GitSuggestion } from '@backend/search/suggestions'
import { trpc } from '@renderer/lib/trpc'
import { useProjectSelectionStore } from '@renderer/stores/project-selection'

export function useGitFlow(): { groups: FlowGroup[] | undefined; refresh: () => Promise<void> } {
  const project = useProjectSelectionStore((s) => s.project)
  const utils = trpc.useUtils()
  const { data: groups, refetch } = trpc.gitFlow.useQuery(project?.path ?? '', {
    enabled: project !== null,
    // working-tree state changes outside the app constantly; keep it live
    staleTime: 0,
    refetchInterval: 3000,
  })

  const refresh = async (): Promise<void> => {
    await Promise.all([refetch(), utils.gitDiffFile.invalidate()])
  }

  return { groups, refresh }
}

export function useGitSuggestions(): GitSuggestion[] {
  const project = useProjectSelectionStore((s) => s.project)
  const { data = [] } = trpc.gitSuggestions.useQuery(project?.path ?? '', {
    enabled: project !== null,
    staleTime: 0,
    refetchInterval: 5000,
  })
  return data
}
