import type { FeatureView } from '@backend/feature-view'
import { trpc } from '@renderer/lib/trpc'
import { useRepoStore } from '@renderer/stores/repo'

export function useFeatureView(): { view: FeatureView | undefined; refresh: () => Promise<void> } {
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
 * Clear the agent review set for the current repo, reverting the feature view to
 * the static baseline. Invalidates both feature surfaces so the list and the
 * inline reading surface refresh.
 */
export function useClearFeatureReview(): { clear: () => Promise<void>; isClearing: boolean } {
  const repo = useRepoStore((s) => s.repo)
  const utils = trpc.useUtils()
  const mutation = trpc.clearFeatureReview.useMutation()
  return {
    clear: async () => {
      if (!repo) return
      await mutation.mutateAsync(repo.path)
      await Promise.all([utils.featureView.invalidate(), utils.featureReading.invalidate()])
    },
    isClearing: mutation.isPending,
  }
}
