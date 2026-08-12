import type { EvidenceAsset, EvidenceAssetBody } from '@backend/review/evidence-assets-list'
import type { Evidence } from '@backend/stores/evidence-store'
import { invalidateAfterSuccess, onMutationError } from '@renderer/hooks/mutation-error'
import { trpc } from '@renderer/lib/trpc'
import { useProjectSelectionStore } from '@renderer/stores/project-selection'

/**
 * The full evidence document for a project — read only while the Review's evidence
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
 * The Assets sub-tab's listing — metadata only (file, label, mime, bytes), never
 * bytes. Cheap enough to hold with the rest of the pack and refreshed by the
 * app-event 'evidence' invalidation when the agent rewrites the directory.
 */
export function useEvidenceAssets(): EvidenceAsset[] {
  const project = useProjectSelectionStore((s) => s.project)
  const { data } = trpc.reviewEvidenceAssets.useQuery(project?.path ?? '', {
    enabled: project !== null,
  })
  return data ?? []
}

/**
 * One gallery image as a data URL. `enabled` is the laziness: a tile's bytes can
 * be megabytes, so the Assets sub-tab passes false until it is the visible pane
 * — nobody pays for a gallery they never open.
 *
 * `staleTime: Infinity` because the bytes are immutable for a given pack; the
 * 'evidence' event drops the whole cache entry rather than refetching each tile.
 * `null` data means over-cap (or vanished): the caller shows the listing's size.
 */
export function useEvidenceAsset(
  file: string,
  enabled: boolean,
): { asset: EvidenceAssetBody | null | undefined; isLoading: boolean } {
  const project = useProjectSelectionStore((s) => s.project)
  const { data, isPending } = trpc.reviewEvidenceAsset.useQuery(
    { repoPath: project?.path ?? '', file },
    { enabled: enabled && project !== null, staleTime: Number.POSITIVE_INFINITY },
  )
  return { asset: data, isLoading: enabled && isPending }
}

/**
 * Clear the agent's loop evidence for the current project — the app's one write to the
 * evidence channel. Invalidates the evidence queries AND featureReading so the
 * Review's evidence chapter (and the outline's Loop evidence row) drop immediately.
 * Clear deletes the whole directory, so the Results and Assets sub-tabs go too.
 */
export function useClearEvidence(): { clear: () => Promise<void>; isClearing: boolean } {
  const project = useProjectSelectionStore((s) => s.project)
  const utils = trpc.useUtils()
  const mutation = trpc.clearLoopEvidence.useMutation({
    onError: onMutationError('Clear evidence'),
  })
  return {
    clear: async () => {
      if (!project) return
      await mutation.mutateAsync(project.path)
      // The delete is durable once the mutation resolves; a failed refresh must not
      // read as a failed clear, so it degrades to a "UI may be stale" toast.
      await invalidateAfterSuccess(
        [
          utils.loopEvidence.invalidate(),
          utils.loopEvidenceHtml.invalidate(),
          utils.reviewEvidenceDocs.invalidate(),
          utils.reviewEvidenceAssets.invalidate(),
          utils.featureReading.invalidate(),
        ],
        'Clear evidence',
      )
    },
    isClearing: mutation.isPending,
  }
}
