import { planClearResolvedReviewComments } from '@porcelain/shared/comments-file'
import type {
  ReviewCommentChanges,
  ReviewCommentOperationResult,
  ReviewCommentStore,
} from './comment-capabilities'

export type ClearResolvedReviewCommentsInput = { projectPath: string }

export function createClearResolvedReviewComments(deps: {
  store: ReviewCommentStore
  changes: ReviewCommentChanges
}) {
  return async function clearResolvedReviewComments(
    input: ClearResolvedReviewCommentsInput,
  ): Promise<ReviewCommentOperationResult<undefined>> {
    const result = await deps.store.transact(input.projectPath, (current) => {
      const planned = planClearResolvedReviewComments(current)
      return {
        ok: true,
        value: {
          kind: 'clear',
          file: planned.file,
          removedIds: planned.removedIds,
        },
      }
    })

    if (!result.ok) return result
    if (result.value.kind !== 'clear') {
      return { ok: false, error: { code: 'review.unavailable' } }
    }

    deps.changes.publish({ type: 'review.changed', projectPath: input.projectPath })
    return { ok: true, value: undefined }
  }
}

export type ClearResolvedReviewComments = ReturnType<typeof createClearResolvedReviewComments>
