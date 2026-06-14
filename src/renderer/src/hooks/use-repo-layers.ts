import type { Layer } from '@main/flow'
import { trpc } from '@renderer/lib/trpc'
import { useRepoStore } from '@renderer/stores/repo'

export function useRepoLayers(): { layers: Layer[]; custom: boolean } | undefined {
  const repo = useRepoStore((s) => s.repo)
  const { data } = trpc.repoLayers.useQuery(repo?.path ?? '', { enabled: repo !== null })
  return data
}

export function useSetRepoLayers(): {
  save: (layers: Layer[] | null) => Promise<void>
  isSaving: boolean
} {
  const utils = trpc.useUtils()
  const mutation = trpc.setRepoLayers.useMutation()
  const save = async (layers: Layer[] | null, repoPath?: string): Promise<void> => {
    if (!repoPath) return
    await mutation.mutateAsync({ repoPath, layers })
    await Promise.all([utils.repoLayers.invalidate(), utils.gitFlow.invalidate()])
  }
  return {
    // repoPath is read from the store so callers stay declarative
    save: (layers) => save(layers, useRepoStore.getState().repo?.path),
    isSaving: mutation.isPending,
  }
}
