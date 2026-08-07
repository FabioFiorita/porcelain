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

/** Whether git is blind to `.porcelain/` in this clone. */
export function useCompanionGitVisibility(): {
  data: { hidden: boolean } | undefined
  isPending: boolean
} {
  const repo = useRepoStore((s) => s.repo)
  const { data, isPending } = trpc.companionGitVisibility.useQuery(repo?.path ?? '', {
    enabled: repo !== null,
  })
  return { data, isPending }
}

export function useSetCompanionGitVisibility(): (hidden: boolean) => Promise<void> {
  const utils = trpc.useUtils()
  const mutation = trpc.setCompanionGitVisibility.useMutation({
    onError: onMutationError('Change git visibility'),
  })
  return async (hidden: boolean): Promise<void> => {
    const repoPath = useRepoStore.getState().repo?.path
    if (!repoPath) return
    await mutation.mutateAsync({ repoPath, hidden })
    await Promise.all([
      utils.companionGitVisibility.invalidate(),
      utils.companionDispositions.invalidate(),
      utils.gitStatus.invalidate(),
    ])
  }
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
      // Going Local stages a deletion; going Shared can lift the clone-wide
      // exclude. Either way the toggle row, the visibility line and Changes are stale.
      await Promise.all([
        utils.companionDispositions.invalidate(),
        utils.companionGitVisibility.invalidate(),
        utils.gitStatus.invalidate(),
      ])
      return result.untracked
    },
    isSaving: mutation.isPending,
  }
}
