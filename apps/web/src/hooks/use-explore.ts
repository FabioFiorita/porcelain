import type { FeatureReading } from '@backend/review/feature-view'
import { trpc } from '@renderer/lib/trpc'
import { useProjectSelectionStore } from '@renderer/stores/project-selection'

/**
 * Read-only feature-flow exploration seeded from a file (whole-file) or a symbol
 * within it. The result is the same reading-surface payload the feature read uses, just
 * derived from an import/reference walk instead of the working tree. A snapshot, not
 * live — exploration is of code you're reading, not changing.
 */
export function useExplore(
  path: string,
  symbol?: string,
): { reading: FeatureReading | undefined; refresh: () => Promise<void> } {
  const project = useProjectSelectionStore((s) => s.project)
  const { data: reading, refetch } = trpc.exploreFeature.useQuery(
    {
      repoPath: project?.path ?? '',
      seed: symbol ? { kind: 'symbol' as const, path, symbol } : { kind: 'file' as const, path },
    },
    { enabled: project !== null && path !== '', staleTime: 60_000 },
  )

  const refresh = async (): Promise<void> => {
    await refetch()
  }

  return { reading, refresh }
}
