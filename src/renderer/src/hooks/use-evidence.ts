import type { Evidence } from '@backend/evidence-store'
import { onMutationError } from '@renderer/hooks/mutation-error'
import { trpc } from '@renderer/lib/trpc'
import { useRepoStore } from '@renderer/stores/repo'

/**
 * The full evidence document for a repo — read only while the Review's evidence
 * chapter is on screen. No poll: it's a static document, and the app-event 'evidence'
 * invalidation refreshes it live on a CLI write; polling the (up to ~4 MB) HTML on a
 * timer would be wasteful. (Chapter presence/meta rides on featureReading.)
 */
export function useEvidenceHtml(repoPath: string): { evidence: Evidence | null | undefined } {
  const { data: evidence } = trpc.loopEvidenceHtml.useQuery(repoPath, {
    enabled: repoPath !== '',
    staleTime: 0,
  })
  return { evidence }
}

/**
 * Clear the agent's loop evidence for the current repo — the app's one write to the
 * evidence channel. Invalidates the evidence queries AND featureReading so the
 * Review's evidence chapter (and the outline's Loop evidence row) drop immediately.
 */
export function useClearEvidence(): { clear: () => Promise<void>; isClearing: boolean } {
  const repo = useRepoStore((s) => s.repo)
  const utils = trpc.useUtils()
  const mutation = trpc.clearLoopEvidence.useMutation({
    onError: onMutationError('Clear loop evidence'),
  })
  return {
    clear: async () => {
      if (!repo) return
      await mutation.mutateAsync(repo.path)
      await Promise.all([
        utils.loopEvidence.invalidate(),
        utils.loopEvidenceHtml.invalidate(),
        utils.featureReading.invalidate(),
      ])
    },
    isClearing: mutation.isPending,
  }
}
