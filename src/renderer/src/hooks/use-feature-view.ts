import type { FeatureView } from '@backend/feature-view'
import { onMutationError } from '@renderer/hooks/mutation-error'
import { trpc } from '@renderer/lib/trpc'
import { useRepoStore } from '@renderer/stores/repo'

/** `view` is `null` when no agent review set exists (the "No review yet" state). */
export function useFeatureView(): {
  view: FeatureView | null | undefined
  refresh: () => Promise<void>
} {
  const repo = useRepoStore((s) => s.repo)
  const { data: view, refetch } = trpc.featureView.useQuery(repo?.path ?? '', {
    enabled: repo !== null,
    // the working tree and the agent channel both change outside the app; keep it
    // live, cheap because main memoizes the view on a status+numstat+layers+set key
    staleTime: 0,
    refetchInterval: 3000,
  })

  const refresh = async (): Promise<void> => {
    await refetch()
  }

  return { view, refresh }
}

/**
 * Clear the agent review set for the current repo — the Review goes back to its
 * "No review yet" empty state until the agent re-pushes. Invalidates both feature
 * surfaces so the outline and the Review document refresh.
 */
export function useClearFeatureReview(): { clear: () => Promise<void>; isClearing: boolean } {
  const repo = useRepoStore((s) => s.repo)
  const utils = trpc.useUtils()
  const mutation = trpc.clearFeatureReview.useMutation({
    onError: onMutationError('Clear review'),
  })
  return {
    clear: async () => {
      if (!repo) return
      await mutation.mutateAsync(repo.path)
      await Promise.all([utils.featureView.invalidate(), utils.featureReading.invalidate()])
    },
    isClearing: mutation.isPending,
  }
}
