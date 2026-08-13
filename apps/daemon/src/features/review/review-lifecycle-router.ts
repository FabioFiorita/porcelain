import { procedureCatalog } from '@porcelain/contracts'
import { expectedFailure } from '../../daemon-composition/expected-failure'
import { toTrpcError } from '../../daemon-composition/public-error'
import { publicProcedure, t } from '../../trpc'
import type { ReviewLifecycleResult } from './review-lifecycle-capabilities'
import type { ReviewLifecycleOperations } from './review-lifecycle-operations'

/**
 * Review lifecycle router — six wire procedures bound to the live catalog names.
 * Each procedure is parse → invoke one operation → map authoritative outputs.
 */

function throwIfFailed<T>(result: ReviewLifecycleResult<T>): T {
  if (result.ok) return result.value
  throw toTrpcError(expectedFailure('review.unavailable'))
}

export function createReviewLifecycleRouter(operations: ReviewLifecycleOperations) {
  return t.router({
    // Archive the active review (intent, comments, reviewed marks, evidence) under
    // .porcelain/reviews/<id>/ and clear the active slots → "No review yet".
    archiveReview: publicProcedure
      .input(procedureCatalog.archiveReview.input)
      .output(procedureCatalog.archiveReview.output)
      .mutation(async ({ input }) => {
        return throwIfFailed(await operations.archiveReview({ projectPath: input }))
      }),

    /** Byte cost of publishing the active review, so the warning can be specific. */
    publishCost: publicProcedure
      .input(procedureCatalog.publishCost.input)
      .output(procedureCatalog.publishCost.output)
      .query(async ({ input }) => {
        return throwIfFailed(await operations.publishCost({ projectPath: input }))
      }),

    /**
     * Archive the active review and stage it for the team. Reviews are Local by
     * default, so this force-adds; it stages and stops, leaving the commit to the
     * human.
     */
    publishReview: publicProcedure
      .input(procedureCatalog.publishReview.input)
      .output(procedureCatalog.publishReview.output)
      .mutation(async ({ input }) => {
        return throwIfFailed(await operations.publishReview({ projectPath: input }))
      }),

    /** Previous (archived) reviews for the project, newest first. */
    archivedReviews: publicProcedure
      .input(procedureCatalog.archivedReviews.input)
      .output(procedureCatalog.archivedReviews.output)
      .query(async ({ input }) => {
        return throwIfFailed(await operations.archivedReviews({ projectPath: input }))
      }),

    restoreArchivedReview: publicProcedure
      .input(procedureCatalog.restoreArchivedReview.input)
      .output(procedureCatalog.restoreArchivedReview.output)
      .mutation(async ({ input }) => {
        return throwIfFailed(
          await operations.restoreArchivedReview({ projectPath: input.repoPath, id: input.id }),
        )
      }),

    deleteArchivedReview: publicProcedure
      .input(procedureCatalog.deleteArchivedReview.input)
      .output(procedureCatalog.deleteArchivedReview.output)
      .mutation(async ({ input }) => {
        return throwIfFailed(
          await operations.deleteArchivedReview({ projectPath: input.repoPath, id: input.id }),
        )
      }),
  })
}
