import type { Artifact, ArtifactMeta } from '@main/artifact-store'
import { trpc } from '@renderer/lib/trpc'
import { useRepoStore } from '@renderer/stores/repo'

/**
 * The feature artifact's metadata (title + updatedAt) for the current repo — cheap
 * enough for the Feature list to poll and show/hide the artifact opener. Mirrors
 * useFeatureView's 3s poll: the artifact is written by an external process, and the
 * app-event 'artifact' invalidation is the primary refresh with the poll as a fallback
 * where fs.watch is unavailable. The full HTML is fetched separately (useArtifactHtml)
 * so this heartbeat never pulls the whole document over IPC.
 */
export function useFeatureArtifact(): { artifact: ArtifactMeta | null | undefined } {
  const repo = useRepoStore((s) => s.repo)
  const { data: artifact } = trpc.featureArtifact.useQuery(repo?.path ?? '', {
    enabled: repo !== null,
    staleTime: 0,
    refetchInterval: 3000,
  })
  return { artifact }
}

/**
 * The full artifact document for a repo — read only while the artifact view is open.
 * No poll: it's a static document, and the app-event 'artifact' invalidation refreshes
 * it live on an MCP write; polling the (up to 1.5 MB) HTML on a timer would be wasteful.
 */
export function useArtifactHtml(repoPath: string): { artifact: Artifact | null | undefined } {
  const { data: artifact } = trpc.featureArtifactHtml.useQuery(repoPath, {
    enabled: repoPath !== '',
    staleTime: 0,
  })
  return { artifact }
}

/**
 * Clear the agent's feature artifact for the current repo — the app's one write to the
 * artifact channel. Invalidates both artifact queries so the Feature list opener and
 * the open view refresh.
 */
export function useClearArtifact(): { clear: () => Promise<void>; isClearing: boolean } {
  const repo = useRepoStore((s) => s.repo)
  const utils = trpc.useUtils()
  const mutation = trpc.clearFeatureArtifact.useMutation()
  return {
    clear: async () => {
      if (!repo) return
      await mutation.mutateAsync(repo.path)
      await Promise.all([
        utils.featureArtifact.invalidate(),
        utils.featureArtifactHtml.invalidate(),
      ])
    },
    isClearing: mutation.isPending,
  }
}
