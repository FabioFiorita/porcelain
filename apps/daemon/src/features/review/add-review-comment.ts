import { planAddReviewComment } from '@porcelain/shared/comments-file'
import type {
  ReviewComment,
  ReviewCommentChanges,
  ReviewCommentClock,
  ReviewCommentIds,
  ReviewCommentOperationResult,
  ReviewCommentStore,
} from './comment-capabilities'

export type AddReviewCommentInput = {
  projectPath: string
  path: string
  startLine?: number
  endLine?: number
  anchorText?: string
  body: string
}

export function createAddReviewComment(deps: {
  store: ReviewCommentStore
  clock: ReviewCommentClock
  ids: ReviewCommentIds
  changes: ReviewCommentChanges
}) {
  return async function addReviewComment(
    input: AddReviewCommentInput,
  ): Promise<ReviewCommentOperationResult<ReviewComment>> {
    const now = deps.clock.now()
    const id = deps.ids.create()

    const result = await deps.store.transact(input.projectPath, (current) => {
      const planned = planAddReviewComment(current, {
        id,
        path: input.path,
        startLine: input.startLine,
        endLine: input.endLine,
        anchorText: input.anchorText,
        body: input.body,
        createdAt: now,
      })
      if (!planned.ok) return planned
      return { ok: true, value: { kind: 'add', file: planned.file, comment: planned.comment } }
    })

    if (!result.ok) return result
    if (result.value.kind !== 'add') {
      return { ok: false, error: { code: 'review.unavailable' } }
    }

    deps.changes.publish({ type: 'review.changed', projectPath: input.projectPath })
    return { ok: true, value: result.value.comment }
  }
}

export type AddReviewComment = ReturnType<typeof createAddReviewComment>
