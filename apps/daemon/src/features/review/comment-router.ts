import { procedureCatalog } from '@porcelain/contracts'
import { expectedFailure } from '../../daemon-composition/expected-failure'
import { toTrpcError } from '../../daemon-composition/public-error'
import { publicProcedure, t } from '../../trpc'
import type { ReviewCommentOperationResult } from './comment-capabilities'
import type { ReviewCommentOperations } from './comment-operations'

/**
 * Review-comment feature router — six wire procedures bound to reviewProcedures.
 * Each procedure is parse → invoke one operation → map authoritative outputs.
 */

function throwIfFailed<T>(result: ReviewCommentOperationResult<T>): T {
  if (result.ok) return result.value
  const error = result.error
  if (error.code === 'review.comment-not-found') {
    throw toTrpcError(expectedFailure('review.comment-not-found', { commentId: error.commentId }))
  }
  if (error.code === 'request.invalid') {
    throw toTrpcError(expectedFailure('request.invalid'))
  }
  throw toTrpcError(expectedFailure('review.unavailable'))
}

export function createReviewCommentRouter(operations: ReviewCommentOperations) {
  return t.router({
    reviewComments: publicProcedure
      .input(procedureCatalog.reviewComments.input)
      .output(procedureCatalog.reviewComments.output)
      .query(async ({ input }) => {
        const result = await operations.listReviewComments({ projectPath: input })
        return throwIfFailed(result)
      }),

    addReviewComment: publicProcedure
      .input(procedureCatalog.addReviewComment.input)
      .output(procedureCatalog.addReviewComment.output)
      .mutation(async ({ input }) => {
        const result = await operations.addReviewComment({
          projectPath: input.repoPath,
          path: input.path,
          startLine: input.startLine,
          endLine: input.endLine,
          anchorText: input.anchorText,
          body: input.body,
        })
        return throwIfFailed(result)
      }),

    editReviewComment: publicProcedure
      .input(procedureCatalog.editReviewComment.input)
      .output(procedureCatalog.editReviewComment.output)
      .mutation(async ({ input }) => {
        const result = await operations.editReviewComment({
          projectPath: input.repoPath,
          commentId: input.id,
          body: input.body,
        })
        return throwIfFailed(result)
      }),

    deleteReviewComment: publicProcedure
      .input(procedureCatalog.deleteReviewComment.input)
      .output(procedureCatalog.deleteReviewComment.output)
      .mutation(async ({ input }) => {
        const result = await operations.deleteReviewComment({
          projectPath: input.repoPath,
          commentId: input.id,
        })
        return throwIfFailed(result)
      }),

    clearResolvedReviewComments: publicProcedure
      .input(procedureCatalog.clearResolvedReviewComments.input)
      .output(procedureCatalog.clearResolvedReviewComments.output)
      .mutation(async ({ input }) => {
        const result = await operations.clearResolvedReviewComments({
          projectPath: input.repoPath,
        })
        return throwIfFailed(result)
      }),

    resolveReviewComment: publicProcedure
      .input(procedureCatalog.resolveReviewComment.input)
      .output(procedureCatalog.resolveReviewComment.output)
      .mutation(async ({ input }) => {
        const result = await operations.resolveReviewComment({
          projectPath: input.repoPath,
          commentId: input.id,
          resolved: input.resolved,
        })
        return throwIfFailed(result)
      }),
  })
}
