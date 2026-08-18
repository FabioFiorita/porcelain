import { planAnswerReviewComment } from '@porcelain/shared/comments-file'
import type {
  ReviewCommentChanges,
  ReviewCommentClock,
  ReviewCommentOperationResult,
  ReviewCommentStore,
} from './comment-capabilities'

export type AnswerReviewCommentInput = {
  projectPath: string
  commentId: string
  body: string
}

/**
 * The agent's answer to a comment the human left.
 *
 * Every part of this existed except the middle: `planAnswerReviewComment` in shared,
 * `agentReply` in the comments file and the wire schema, and `comment-marker.tsx`
 * already drawing the reply. What was missing was anything able to write one — the
 * retired MCP server's `answer_review_comment` had no CLI successor, so the review
 * loop has been open ever since, with the UI waiting on a field nothing could fill.
 *
 * Answering is all an agent may do here. Resolving and deleting stay human-only: an
 * agent that could close its own review comment could mark its own work accepted.
 */
export function createAnswerReviewComment(deps: {
  store: ReviewCommentStore
  changes: ReviewCommentChanges
  clock: ReviewCommentClock
}) {
  return async function answerReviewComment(
    input: AnswerReviewCommentInput,
  ): Promise<ReviewCommentOperationResult<undefined>> {
    const result = await deps.store.transact(input.projectPath, (current) => {
      const planned = planAnswerReviewComment(current, {
        commentId: input.commentId,
        body: input.body,
        createdAt: deps.clock.now(),
      })
      if (!planned.ok) return planned
      return { ok: true, value: { kind: 'answer', file: planned.file, comment: planned.comment } }
    })

    if (!result.ok) return result
    if (result.value.kind !== 'answer') {
      return { ok: false, error: { code: 'review.unavailable' } }
    }

    deps.changes.publish({ type: 'review.changed', projectPath: input.projectPath })
    return { ok: true, value: undefined }
  }
}

export type AnswerReviewComment = ReturnType<typeof createAnswerReviewComment>
