import type { FeatureReading } from '@backend/feature-view'
import { trpc } from '@renderer/lib/trpc'
import { useRepoStore } from '@renderer/stores/repo'

export type DiffReadingScope =
  | { type: 'working' }
  | { type: 'branch' }
  | { type: 'commit'; hash: string }

/**
 * Continuous stacked-diff reading surface for Changes (working/branch) and
 * History (one commit). `undefined` while loading; empty `groups` when there
 * are no changed files.
 */
export function useDiffReading(scope: DiffReadingScope): {
  reading: FeatureReading | undefined
  error: { message: string } | null
} {
  const repo = useRepoStore((s) => s.repo)
  const live = scope.type === 'working'
  const { data: reading, error } = trpc.diffReading.useQuery(
    { repoPath: repo?.path ?? '', scope },
    {
      enabled: repo !== null,
      // Working tree changes under the agent; poll like gitFlow. Branch/commit
      // are static until the next commit, so don't burn a 3s poll on them.
      staleTime: live ? 0 : Number.POSITIVE_INFINITY,
      refetchInterval: live ? 3000 : false,
    },
  )
  return { reading, error }
}
