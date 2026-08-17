import { planDeleteReviewComment } from '@porcelain/shared/comments-file'
import type {
  ReviewCommentChanges,
  ReviewCommentOperationResult,
  ReviewCommentStore,
} from './comment-capabilities'

export type DeleteReviewCommentInput = {
  projectPath: string
  commentId: string
}

export function createDeleteReviewComment(deps: {
  store: ReviewCommentStore
  changes: ReviewCommentChanges
}) {
  return async function deleteReviewComment(
    input: DeleteReviewCommentInput,
  ): Promise<ReviewCommentOperationResult<undefined>> {
    const result = await deps.store.transact(input.projectPath, (current) => {
      const planned = planDeleteReviewComment(current, { commentId: input.commentId })
      if (!planned.ok) return planned
      return {
        ok: true,
        value: { kind: 'delete', file: planned.file, commentId: planned.commentId },
      }
    })

    if (!result.ok) return result
    if (result.value.kind !== 'delete') {
      return { ok: false, error: { code: 'review.unavailable' } }
    }

    deps.changes.publish({ type: 'review.changed', projectPath: input.projectPath })
    return { ok: true, value: undefined }
  }
}

export type DeleteReviewComment = ReturnType<typeof createDeleteReviewComment>
