import type { CommentsFileComment, CommentsFileV1 } from '@porcelain/shared/comments-file'

/** Expected store/adapter failure: host I/O or unusable document. */
export type ReviewUnavailableError = { code: 'review.unavailable' }

export type ReviewCommentNotFoundError = {
  code: 'review.comment-not-found'
  commentId: string
}

export type ReviewRequestInvalidError = { code: 'request.invalid' }

export type ReviewCommentStoreResult<T> =
  | { ok: true; value: T }
  | { ok: false; error: ReviewUnavailableError }

export type ReviewCommentChangeResult =
  | { ok: true; value: ReviewCommentChange }
  | { ok: false; error: ReviewCommentNotFoundError | ReviewRequestInvalidError }

/**
 * Durable mutation outcome after a successful atomic write. Carries the next file
 * snapshot plus the authoritative mutation payload for the calling operation.
 */
export type ReviewCommentChange =
  | { kind: 'add'; file: CommentsFileV1; comment: CommentsFileComment }
  | { kind: 'edit'; file: CommentsFileV1; comment: CommentsFileComment }
  | { kind: 'answer'; file: CommentsFileV1; comment: CommentsFileComment }
  | { kind: 'delete'; file: CommentsFileV1; commentId: string }
  | { kind: 'resolve'; file: CommentsFileV1; comment: CommentsFileComment }
  | { kind: 'clear'; file: CommentsFileV1; removedIds: string[] }

/** Outcome of a transactional mutation: durable success, domain reject, or adapter failure. */
export type ReviewCommentTransactResult =
  | { ok: true; value: ReviewCommentChange }
  | {
      ok: false
      error: ReviewUnavailableError | ReviewCommentNotFoundError | ReviewRequestInvalidError
    }

export type ReviewCommentStore = {
  read(projectPath: string): Promise<ReviewCommentStoreResult<CommentsFileV1>>
  transact(
    projectPath: string,
    change: (current: CommentsFileV1) => ReviewCommentChangeResult,
  ): Promise<ReviewCommentTransactResult>
}

export type ReviewCommentClock = { now(): number }
export type ReviewCommentIds = { create(): string }

/** Domain-facing change fact. The publisher maps `type` onto the session `kind` wire. */
export type ReviewCommentChanges = {
  publish(change: { type: 'review.changed'; projectPath: string }): void
}

export type ReviewCommentOperationResult<T> =
  | { ok: true; value: T }
  | {
      ok: false
      error: ReviewUnavailableError | ReviewCommentNotFoundError | ReviewRequestInvalidError
    }

export type ReviewComment = CommentsFileComment
