import type { ChannelDisposition } from '@backend/project/companion-disposition'
import { onMutationError } from '@renderer/hooks/mutation-error'
import { trpc } from '@renderer/lib/trpc'
import { useRepoStore } from '@renderer/stores/repo'
import type { CompanionDisposition } from '@shared/project-porcelain'

export function useCompanionDispositions(): ChannelDisposition[] | undefined {
  const repo = useRepoStore((s) => s.repo)
  const { data } = trpc.companionDispositions.useQuery(repo?.path ?? '', { enabled: repo !== null })
  return data
}

export function useSetCompanionDisposition(): {
  set: (key: string, disposition: CompanionDisposition) => Promise<string[]>
  isSaving: boolean
} {
  const utils = trpc.useUtils()
  const mutation = trpc.setCompanionDisposition.useMutation({
    onError: onMutationError('Change what git carries'),
  })
  return {
    set: async (key, disposition): Promise<string[]> => {
      const repoPath = useRepoStore.getState().repo?.path
      if (!repoPath) return []
      const result = await mutation.mutateAsync({ repoPath, key, disposition })
      // Going Local stages a deletion, so the Changes tab is now stale as well as
      // the toggle row itself.
      await Promise.all([utils.companionDispositions.invalidate(), utils.gitStatus.invalidate()])
      return result.untracked
    },
    isSaving: mutation.isPending,
  }
}
