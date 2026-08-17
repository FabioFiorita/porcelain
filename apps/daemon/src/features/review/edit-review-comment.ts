import { planEditReviewComment } from '@porcelain/shared/comments-file'
import type {
  ReviewCommentChanges,
  ReviewCommentOperationResult,
  ReviewCommentStore,
} from './comment-capabilities'

export type EditReviewCommentInput = {
  projectPath: string
  commentId: string
  body: string
}

export function createEditReviewComment(deps: {
  store: ReviewCommentStore
  changes: ReviewCommentChanges
}) {
  return async function editReviewComment(
    input: EditReviewCommentInput,
  ): Promise<ReviewCommentOperationResult<undefined>> {
    const result = await deps.store.transact(input.projectPath, (current) => {
      const planned = planEditReviewComment(current, {
        commentId: input.commentId,
        body: input.body,
      })
      if (!planned.ok) return planned
      return { ok: true, value: { kind: 'edit', file: planned.file, comment: planned.comment } }
    })

    if (!result.ok) return result
    if (result.value.kind !== 'edit') {
      return { ok: false, error: { code: 'review.unavailable' } }
    }

    deps.changes.publish({ type: 'review.changed', projectPath: input.projectPath })
    return { ok: true, value: undefined }
  }
}

export type EditReviewComment = ReturnType<typeof createEditReviewComment>
