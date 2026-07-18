import type { FeatureReading } from '@backend/feature-view'
import { trpc } from '@renderer/lib/trpc'
import { useRepoStore } from '@renderer/stores/repo'

/**
 * The Review document payload (thesis, walkthrough sections, unanchored groups,
 * evidence meta). `null` means no agent review set — the "No review yet" empty
 * state; `undefined` while loading.
 */
export function useFeatureReading(): {
  reading: FeatureReading | null | undefined
  refresh: () => Promise<void>
} {
  const repo = useRepoStore((s) => s.repo)
  const { data: reading, refetch } = trpc.featureReading.useQuery(repo?.path ?? '', {
    enabled: repo !== null,
    // same liveness as the feature view: the working tree and the agent channel
    // both change outside the app; main memoizes on a status+set key so the poll
    // only re-slices when something changed
    staleTime: 0,
    refetchInterval: 3000,
  })

  const refresh = async (): Promise<void> => {
    await refetch()
  }

  return { reading, refresh }
}
