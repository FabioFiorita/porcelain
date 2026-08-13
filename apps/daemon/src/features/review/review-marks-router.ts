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
    // A mark stores a content fingerprint (sha256 of the file's diff vs HEAD) so it
    // can be reconciled: this read re-derives each marked file's current fingerprint
    // and prunes any mark whose content changed.
    reviewedPaths: publicProcedure
      .input(procedureCatalog.reviewedPaths.input)
      .output(procedureCatalog.reviewedPaths.output)
      .query(
        ({ input }): Promise<string[]> => operations.readReviewedPaths({ projectPath: input }),
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
        })
      }),
  })
}
