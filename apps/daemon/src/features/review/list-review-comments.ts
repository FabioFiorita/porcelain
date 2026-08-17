import { sortComments } from '@porcelain/shared/comments-file'
import type {
  ReviewComment,
  ReviewCommentOperationResult,
  ReviewCommentStore,
} from './comment-capabilities'

export type ListReviewCommentsInput = { projectPath: string }

export function createListReviewComments(deps: { store: ReviewCommentStore }) {
  return async function listReviewComments(
    input: ListReviewCommentsInput,
  ): Promise<ReviewCommentOperationResult<ReviewComment[]>> {
    const read = await deps.store.read(input.projectPath)
    if (!read.ok) return read
    return { ok: true, value: sortComments(read.value.comments) }
  }
}

export type ListReviewComments = ReturnType<typeof createListReviewComments>
