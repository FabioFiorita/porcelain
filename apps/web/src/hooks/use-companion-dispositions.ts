import type { ChannelDispositionValue } from '@porcelain/contracts/project-data'
import { invalidateAfterSuccess, onMutationError } from '@renderer/hooks/mutation-error'
import { trpc } from '@renderer/lib/trpc'
import { useProjectSelectionStore } from '@renderer/stores/project-selection'
import type { CompanionDisposition } from '@shared/project-porcelain'

export function useCompanionDispositions(): ChannelDispositionValue[] | undefined {
  const project = useProjectSelectionStore((s) => s.project)
  const { data } = trpc.companionDispositions.useQuery(project?.path ?? '', {
    enabled: project !== null,
  })
  return data
}

/** Whether git is blind to `.porcelain/` in this clone. */
export function useCompanionGitVisibility(): {
  data: { hidden: boolean } | undefined
  isPending: boolean
} {
  const project = useProjectSelectionStore((s) => s.project)
  const { data, isPending } = trpc.companionGitVisibility.useQuery(project?.path ?? '', {
    enabled: project !== null,
  })
  return { data, isPending }
}

export function useSetCompanionGitVisibility(): (hidden: boolean) => Promise<void> {
  const utils = trpc.useUtils()
  const mutation = trpc.setCompanionGitVisibility.useMutation({
    onError: onMutationError('Change git visibility'),
  })
  return async (hidden: boolean): Promise<void> => {
    const repoPath = useProjectSelectionStore.getState().project?.path
    if (!repoPath) return
    await mutation.mutateAsync({ repoPath, hidden })
    await invalidateAfterSuccess(
      [
        utils.companionGitVisibility.invalidate(),
        utils.companionDispositions.invalidate(),
        utils.gitStatus.invalidate(),
      ],
      'Change git visibility',
    )
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
      const repoPath = useProjectSelectionStore.getState().project?.path
      if (!repoPath) return []
      const result = await mutation.mutateAsync({ repoPath, key, disposition })
      // Going Local stages a deletion; going Shared can lift the clone-wide
      // exclude. Either way the toggle row, the visibility line and Changes are stale.
      await invalidateAfterSuccess(
        [
          utils.companionDispositions.invalidate(),
          utils.companionGitVisibility.invalidate(),
          utils.gitStatus.invalidate(),
        ],
        'Change what git carries',
      )
      return result.untracked
    },
    isSaving: mutation.isPending,
  }
}
