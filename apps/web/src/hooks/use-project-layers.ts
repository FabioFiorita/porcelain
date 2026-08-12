import type { Layer } from '@backend/review/flow'
import { invalidateAfterSuccess } from '@renderer/hooks/mutation-error'
import { trpc } from '@renderer/lib/trpc'
import { useProjectSelectionStore } from '@renderer/stores/project-selection'

export function useProjectLayers(): { layers: Layer[]; custom: boolean } | undefined {
  const project = useProjectSelectionStore((s) => s.project)
  const { data } = trpc.repoLayers.useQuery(project?.path ?? '', { enabled: project !== null })
  return data
}

export function useSetProjectLayers(): {
  save: (layers: Layer[] | null) => Promise<void>
  isSaving: boolean
} {
  const utils = trpc.useUtils()
  // Rejects rather than toasting: the Save / Reset buttons own the failure through
  // runUserAction. (invalidateAfterSuccess below reports a DIFFERENT failure — the
  // write landed but the cache did not — so it stays.)
  const mutation = trpc.setRepoLayers.useMutation()
  const save = async (layers: Layer[] | null, projectPath?: string): Promise<void> => {
    if (!projectPath) return
    await mutation.mutateAsync({ repoPath: projectPath, layers })
    // Refresh every surface that buckets files by layer — same set the CLI-driven
    // `review.changed` invalidates (use-session-runtime.ts), so a Settings edit and an
    // agent edit refresh identically.
    await invalidateAfterSuccess(
      [
        utils.repoLayers.invalidate(),
        utils.gitFlow.invalidate(),
        utils.gitRangeFlow.invalidate(),
        utils.featureView.invalidate(),
        utils.featureReading.invalidate(),
        utils.exploreFeature.invalidate(),
      ],
      'Save layers',
    )
  }
  return {
    // Project path is read from the store so callers stay declarative
    save: (layers: Layer[] | null): Promise<void> =>
      save(layers, useProjectSelectionStore.getState().project?.path),
    isSaving: mutation.isPending,
  }
}
