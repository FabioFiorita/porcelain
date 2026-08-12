import type { FeatureView } from '@backend/review/feature-view'
import { invalidateAllReviewComments } from '@renderer/features/review/comments'
import { invalidateAfterSuccess, onMutationError } from '@renderer/hooks/mutation-error'
import { trpc } from '@renderer/lib/trpc'
import { useProjectSelectionStore } from '@renderer/stores/project-selection'
import { useQueryClient } from '@tanstack/react-query'

/** `view` is `null` when no agent review set exists (the "No review yet" state). */
export function useFeatureView(): {
  view: FeatureView | null | undefined
  refresh: () => Promise<void>
} {
  const project = useProjectSelectionStore((s) => s.project)
  const { data: view, refetch } = trpc.featureView.useQuery(project?.path ?? '', {
    enabled: project !== null,
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
 * Archive the active review (intent, comments, reviewed, evidence) under
 * `.porcelain/reviews/<id>/` and clear active slots → "No review yet".
 */
export function useClearFeatureReview(): { clear: () => Promise<void>; isClearing: boolean } {
  const project = useProjectSelectionStore((s) => s.project)
  const utils = trpc.useUtils()
  const queryClient = useQueryClient()
  const mutation = trpc.clearFeatureReview.useMutation({
    onError: onMutationError('Archive review'),
  })
  return {
    clear: async () => {
      if (!project) return
      await mutation.mutateAsync(project.path)
      // The archive is already on disk; only the refresh can still fail.
      await invalidateAfterSuccess(
        [
          utils.featureView.invalidate(),
          utils.featureReading.invalidate(),
          utils.loopEvidence.invalidate(),
          utils.loopEvidenceHtml.invalidate(),
          utils.archivedReviews.invalidate(),
          invalidateAllReviewComments(queryClient),
          utils.reviewedPaths.invalidate(),
        ],
        'Archive review',
      )
    },
    isClearing: mutation.isPending,
  }
}

export interface ArchivedReviewRow {
  id: string
  name: string
  thesis?: string
  archivedAt: string
}

export function useArchivedReviews(): ArchivedReviewRow[] {
  const project = useProjectSelectionStore((s) => s.project)
  const { data } = trpc.archivedReviews.useQuery(project?.path ?? '', {
    enabled: project !== null,
    staleTime: 2000,
    refetchInterval: 5000,
  })
  return data ?? []
}

export function useArchivedReviewActions(): {
  restore: (id: string) => Promise<void>
  remove: (id: string) => Promise<void>
  isBusy: boolean
} {
  const project = useProjectSelectionStore((s) => s.project)
  const utils = trpc.useUtils()
  const queryClient = useQueryClient()
  const restoreMut = trpc.restoreArchivedReview.useMutation({
    onError: onMutationError('Restore review'),
  })
  const deleteMut = trpc.deleteArchivedReview.useMutation({
    onError: onMutationError('Delete review'),
  })

  const invalidateAll = async (): Promise<void> => {
    await Promise.all([
      utils.featureView.invalidate(),
      utils.featureReading.invalidate(),
      utils.loopEvidence.invalidate(),
      utils.loopEvidenceHtml.invalidate(),
      utils.archivedReviews.invalidate(),
      invalidateAllReviewComments(queryClient),
      utils.reviewedPaths.invalidate(),
    ])
  }

  return {
    restore: async (id) => {
      if (!project) return
      await restoreMut.mutateAsync({ repoPath: project.path, id })
      await invalidateAll()
    },
    remove: async (id) => {
      if (!project) return
      await deleteMut.mutateAsync({ repoPath: project.path, id })
      await utils.archivedReviews.invalidate()
    },
    isBusy: restoreMut.isPending || deleteMut.isPending,
  }
}
