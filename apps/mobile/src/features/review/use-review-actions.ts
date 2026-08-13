import { type ReviewQueryEffect, reviewMutations } from '@porcelain/client-runtime/review'
import { type UseMutationResult, useMutation, useQueryClient } from '@tanstack/react-query'

import { invalidateAllReviewComments } from '@/features/comments'
import { isPaired } from '@/features/remote'
import type { DaemonError } from '@/lib/daemon/errors'
import type { DaemonMutation } from '@/lib/daemon/procedure'
import {
  archiveReviewProcedure,
  clearEvidenceProcedure,
  deleteArchivedReviewProcedure,
  publishReviewProcedure,
  restoreArchivedReviewProcedure,
} from './review-procedures'
import { invalidateReviewEffects } from './review-query-filter'
import { callReview, useReviewScope } from './use-review-transport'

/**
 * The consequential Review writes: publish, archive, clear evidence, restore and delete.
 *
 * Invalidate-only, like every other mutation on this seam. An optimistic Review is a web-only
 * idea and a bad one here — the daemon moves directories on disk, and a client that painted
 * the result first would show an archived unit that is still there because the copy failed.
 * What each write makes stale is declared once in `reviewMutations`, so the two clients cannot
 * drift on the consequence of the same write.
 */

function useReviewMutation<TInput, TOutput>(
  procedure: DaemonMutation<TInput, TOutput>,
  affectedQueries: (input: TInput) => readonly ReviewQueryEffect[],
): UseMutationResult<TOutput, DaemonError, TInput> {
  const scope = useReviewScope()
  const queryClient = useQueryClient()

  return useMutation<TOutput, DaemonError, TInput>({
    mutationFn: (input): Promise<TOutput> => callReview(scope.environment, procedure, input),
    onSuccess: async (_value, input): Promise<void> => {
      await invalidateReviewEffects(queryClient, scope.environmentId, affectedQueries(input))
    },
  })
}

export type ReviewActions = {
  /** Archive + force-stage for the team. Resolves to the archive id, or null if nothing was active. */
  publish: () => Promise<string | null>
  /** Archive the active unit and empty the slots. */
  archive: () => Promise<void>
  /** Drop the evidence pack, leaving the rest of the review in place. */
  clearEvidence: () => Promise<void>
  isPending: boolean
}

/** The consequential writes: publish, archive, and clear evidence. */
export function useReviewActions(): ReviewActions {
  const scope = useReviewScope()
  const queryClient = useQueryClient()
  const publish = useReviewMutation(
    publishReviewProcedure,
    reviewMutations.publishReview.affectedQueries,
  )
  const archive = useReviewMutation(
    archiveReviewProcedure,
    reviewMutations.archiveReview.affectedQueries,
  )
  const clearEvidence = useReviewMutation(
    clearEvidenceProcedure,
    reviewMutations.clearEvidence.affectedQueries,
  )

  const invalidateComments = async (): Promise<void> => {
    if (!isPaired(scope.environment)) return
    await invalidateAllReviewComments(queryClient, scope.environment.id)
  }

  return {
    archive: async (): Promise<void> => {
      if (scope.repoPath === '') return
      await archive.mutateAsync(scope.repoPath)
      await invalidateComments()
    },
    clearEvidence: async (): Promise<void> => {
      if (scope.repoPath === '') return
      await clearEvidence.mutateAsync(scope.repoPath)
    },
    isPending: publish.isPending || archive.isPending || clearEvidence.isPending,
    publish: async (): Promise<string | null> => {
      if (scope.repoPath === '') return null
      const result = await publish.mutateAsync(scope.repoPath)
      await invalidateComments()
      return result?.id ?? null
    },
  }
}

export type ArchivedReviewActions = {
  restore: (id: string) => Promise<void>
  remove: (id: string) => Promise<void>
  isPending: boolean
}

/** Promote an archive back to active, or delete it for good. */
export function useArchivedReviewActions(): ArchivedReviewActions {
  const scope = useReviewScope()
  const queryClient = useQueryClient()
  const restore = useReviewMutation(
    restoreArchivedReviewProcedure,
    reviewMutations.restoreArchivedReview.affectedQueries,
  )
  const remove = useReviewMutation(
    deleteArchivedReviewProcedure,
    reviewMutations.deleteArchivedReview.affectedQueries,
  )

  const invalidateComments = async (): Promise<void> => {
    if (!isPaired(scope.environment)) return
    await invalidateAllReviewComments(queryClient, scope.environment.id)
  }

  return {
    isPending: restore.isPending || remove.isPending,
    remove: async (id: string): Promise<void> => {
      if (scope.repoPath === '') return
      await remove.mutateAsync({ id, repoPath: scope.repoPath })
      await invalidateComments()
    },
    restore: async (id: string): Promise<void> => {
      if (scope.repoPath === '') return
      await restore.mutateAsync({ id, repoPath: scope.repoPath })
      await invalidateComments()
    },
  }
}
