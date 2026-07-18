import type { Evidence, EvidenceMeta } from '@backend/evidence-store'
import { onMutationError } from '@renderer/hooks/mutation-error'
import { trpc } from '@renderer/lib/trpc'
import { useRepoStore } from '@renderer/stores/repo'

/**
 * Loop evidence metadata (title + updatedAt) for the current repo — cheap enough for
 * the Feature list to poll and show/hide the evidence opener. Mirrors useFeatureArtifact's
 * 3s poll: evidence is written by an external process, and the app-event 'evidence'
 * invalidation is the primary refresh with the poll as a fallback where fs.watch is
 * unavailable. The full HTML is fetched separately (useEvidenceHtml) so this heartbeat
 * never pulls the whole document over IPC.
 */
export function useLoopEvidence(): { evidence: EvidenceMeta | null | undefined } {
  const repo = useRepoStore((s) => s.repo)
  const { data: evidence } = trpc.loopEvidence.useQuery(repo?.path ?? '', {
    enabled: repo !== null,
    staleTime: 0,
    refetchInterval: 3000,
  })
  return { evidence }
}

/**
 * The full evidence document for a repo — read only while the evidence view is open.
 * No poll: it's a static document, and the app-event 'evidence' invalidation refreshes
 * it live on a CLI write; polling the (up to 1.5 MB) HTML on a timer would be wasteful.
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
 * evidence channel. Invalidates both evidence queries so the Feature list opener and
 * the open view refresh.
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
      await Promise.all([utils.loopEvidence.invalidate(), utils.loopEvidenceHtml.invalidate()])
    },
    isClearing: mutation.isPending,
  }
}
