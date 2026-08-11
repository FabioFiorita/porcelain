import { planSetReviewCommentResolved } from '@porcelain/shared/comments-file'
import type {
  ReviewCommentChanges,
  ReviewCommentOperationResult,
  ReviewCommentStore,
} from './comment-capabilities'

export type ResolveReviewCommentInput = {
  projectPath: string
  commentId: string
  resolved: boolean
}

export function createResolveReviewComment(deps: {
  store: ReviewCommentStore
  changes: ReviewCommentChanges
}) {
  return async function resolveReviewComment(
    input: ResolveReviewCommentInput,
  ): Promise<ReviewCommentOperationResult<undefined>> {
    const result = await deps.store.transact(input.projectPath, (current) => {
      const planned = planSetReviewCommentResolved(current, {
        commentId: input.commentId,
        resolved: input.resolved,
      })
      if (!planned.ok) return planned
      return {
        ok: true,
        value: { kind: 'resolve', file: planned.file, comment: planned.comment },
      }
    })

    if (!result.ok) return result
    if (result.value.kind !== 'resolve') {
      return { ok: false, error: { code: 'review.unavailable' } }
    }

    deps.changes.publish({ type: 'review.changed', projectPath: input.projectPath })
    return { ok: true, value: undefined }
  }
}

export type ResolveReviewComment = ReturnType<typeof createResolveReviewComment>
