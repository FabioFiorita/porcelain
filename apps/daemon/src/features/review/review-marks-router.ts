import { procedureCatalog } from '@porcelain/contracts'
import { publicProcedure, t } from '../../trpc'
import type { ReviewMarksOperations } from './review-marks-operations'

/**
 * Reviewed-marks router — two wire procedures bound to the canonical catalog names.
 * Each procedure is parse → invoke one operation → serialize. Neither has an expected
 * typed failure: a missing `reviewed.json` is an empty set, and a genuine Git or
 * filesystem failure throws and serializes as `internal.unexpected`.
 */
export function createReviewMarksRouter(operations: ReviewMarksOperations) {
  return t.router({
    // A mark stores a fingerprint of the file in its working or branch comparison, so
    // this read can prune it when that exact reviewed content changes.
    reviewedPaths: publicProcedure
      .input(procedureCatalog.reviewedPaths.input)
      .output(procedureCatalog.reviewedPaths.output)
      .query(
        ({ input }): Promise<string[]> =>
          operations.readReviewedPaths(
            typeof input === 'string'
              ? { projectPath: input }
              : { projectPath: input.repoPath, scope: input.scope },
          ),
      ),

    // Total and idempotent: one bulk "mark all" or "unmark all" is one atomic write,
    // and a single file toggling is the same call with one path.
    setReviewed: publicProcedure
      .input(procedureCatalog.setReviewed.input)
      .output(procedureCatalog.setReviewed.output)
      .mutation(async ({ input }) => {
        await operations.setReviewed({
          projectPath: input.repoPath,
          paths: input.paths,
          reviewed: input.reviewed,
          scope: input.scope,
        })
      }),
  })
}
