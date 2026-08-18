import { randomUUID } from 'node:crypto'
import type { SessionChange } from '@porcelain/contracts/session'
import { createAddReviewComment } from './add-review-comment'
import { createAnswerReviewComment } from './answer-review-comment'
import { createClearResolvedReviewComments } from './clear-resolved-review-comments'
import type {
  ReviewCommentChanges,
  ReviewCommentClock,
  ReviewCommentIds,
  ReviewCommentStore,
} from './comment-capabilities'
import { createReviewCommentChangesPublisher } from './comment-notifications'
import { createDeleteReviewComment } from './delete-review-comment'
import { createEditReviewComment } from './edit-review-comment'
import { createJsonCommentStore } from './json-comment-store'
import { createListReviewComments } from './list-review-comments'
import { createResolveReviewComment } from './resolve-review-comment'

export type ReviewCommentOperations = {
  listReviewComments: ReturnType<typeof createListReviewComments>
  addReviewComment: ReturnType<typeof createAddReviewComment>
  editReviewComment: ReturnType<typeof createEditReviewComment>
  answerReviewComment: ReturnType<typeof createAnswerReviewComment>
  deleteReviewComment: ReturnType<typeof createDeleteReviewComment>
  resolveReviewComment: ReturnType<typeof createResolveReviewComment>
  clearResolvedReviewComments: ReturnType<typeof createClearResolvedReviewComments>
}

export function createReviewCommentOperations(options: {
  store?: ReviewCommentStore
  clock?: ReviewCommentClock
  ids?: ReviewCommentIds
  changes?: ReviewCommentChanges
  publishSessionChange?: (change: SessionChange) => void
}): ReviewCommentOperations {
  const store = options.store ?? createJsonCommentStore()
  const clock = options.clock ?? { now: () => Date.now() }
  const ids = options.ids ?? { create: () => randomUUID() }
  const changes =
    options.changes ??
    createReviewCommentChangesPublisher(options.publishSessionChange ?? (() => undefined))

  return Object.freeze({
    listReviewComments: createListReviewComments({ store }),
    addReviewComment: createAddReviewComment({ store, clock, ids, changes }),
    editReviewComment: createEditReviewComment({ store, changes }),
    answerReviewComment: createAnswerReviewComment({ store, changes, clock }),
    deleteReviewComment: createDeleteReviewComment({ store, changes }),
    resolveReviewComment: createResolveReviewComment({ store, changes }),
    clearResolvedReviewComments: createClearResolvedReviewComments({ store, changes }),
  })
}
