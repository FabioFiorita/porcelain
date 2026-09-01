import type {
  AddReviewCommentInput,
  ClearResolvedReviewCommentsInput,
  DeleteReviewCommentInput,
  EditReviewCommentInput,
  ResolveReviewCommentInput,
  ReviewComment,
} from '@porcelain/contracts/review'

/**
 * Pure Review-comment optimistic transitions, rollback, and add reconciliation.
 *
 * No ambient clock or id generator — the adapter supplies `temporaryId` and `now`.
 * Daemon results remain authoritative; every mutation still requires the declared refetch.
 */

/** Adapter-provided values for temporary add identity and createdAt. Never ambient. */
export type ReviewCommentOptimisticContext = {
  readonly temporaryId: string
  readonly now: number
}

/** Exact pre-mutation comment collection for rollback. */
export type ReviewCommentOptimisticSnapshot = {
  readonly comments: readonly ReviewComment[]
}

export type ReviewCommentMutationKey = 'add' | 'edit' | 'delete' | 'setResolved' | 'clearResolved'

type ReviewCommentMutationInputByKey = {
  add: AddReviewCommentInput
  edit: EditReviewCommentInput
  delete: DeleteReviewCommentInput
  setResolved: ResolveReviewCommentInput
  clearResolved: ClearResolvedReviewCommentsInput
}

export type ReviewCommentOptimisticTransitionResult = {
  readonly comments: readonly ReviewComment[]
  readonly snapshot: ReviewCommentOptimisticSnapshot
}

/**
 * Apply a pure optimistic transition. Returns the next collection and a snapshot of the
 * pre-mutation comments. Transitions against an absent id leave the collection unchanged.
 */
export function applyReviewCommentOptimisticTransition<K extends ReviewCommentMutationKey>(
  comments: readonly ReviewComment[],
  mutation: K,
  input: ReviewCommentMutationInputByKey[K],
  optimistic: ReviewCommentOptimisticContext,
): ReviewCommentOptimisticTransitionResult {
  const snapshot: ReviewCommentOptimisticSnapshot = { comments: comments.slice() }
  const next = transition(comments, mutation, input, optimistic)
  return { comments: next, snapshot }
}

/** Restore the exact pre-mutation comment collection. */
export function rollbackReviewCommentOptimisticTransition(
  snapshot: ReviewCommentOptimisticSnapshot,
): readonly ReviewComment[] {
  return snapshot.comments
}

/**
 * Reconcile after a successful mutation. Add replaces the temporary comment with the
 * authoritative result when supplied; every other path returns the optimistic collection.
 * Authoritative refetch remains required regardless.
 */
export function reconcileReviewCommentMutation(
  comments: readonly ReviewComment[],
  mutation: ReviewCommentMutationKey,
  options: {
    readonly temporaryId?: string
    readonly result?: ReviewComment
  } = {},
): readonly ReviewComment[] {
  if (mutation !== 'add') {
    return comments
  }
  const temporaryId = options.temporaryId
  const result = options.result
  if (temporaryId === undefined || result === undefined) {
    return comments
  }
  return comments.map((comment) => (comment.id === temporaryId ? result : comment))
}

function transition<K extends ReviewCommentMutationKey>(
  comments: readonly ReviewComment[],
  mutation: K,
  input: ReviewCommentMutationInputByKey[K],
  optimistic: ReviewCommentOptimisticContext,
): readonly ReviewComment[] {
  switch (mutation) {
    case 'add': {
      const addInput = input as AddReviewCommentInput
      const comment: ReviewComment = {
        id: optimistic.temporaryId,
        path: addInput.path,
        body: addInput.body,
        resolved: false,
        createdAt: optimistic.now,
        ...(addInput.startLine !== undefined ? { startLine: addInput.startLine } : {}),
        ...(addInput.endLine !== undefined ? { endLine: addInput.endLine } : {}),
        ...(addInput.anchorText !== undefined ? { anchorText: addInput.anchorText } : {}),
      }
      // Prepend so newest-first order matches daemon list order.
      return [comment, ...comments]
    }
    case 'edit': {
      const editInput = input as EditReviewCommentInput
      if (!comments.some((comment) => comment.id === editInput.id)) {
        return comments
      }
      return comments.map((comment) => {
        if (comment.id !== editInput.id) return comment
        return { ...comment, body: editInput.body }
      })
    }
    case 'delete': {
      const deleteInput = input as DeleteReviewCommentInput
      if (!comments.some((comment) => comment.id === deleteInput.id)) {
        return comments
      }
      return comments.filter((comment) => comment.id !== deleteInput.id)
    }
    case 'setResolved': {
      const resolveInput = input as ResolveReviewCommentInput
      if (!comments.some((comment) => comment.id === resolveInput.id)) {
        return comments
      }
      return comments.map((comment) => {
        if (comment.id !== resolveInput.id) return comment
        return { ...comment, resolved: resolveInput.resolved }
      })
    }
    case 'clearResolved': {
      return comments.filter((comment) => comment.resolved === false)
    }
    default: {
      const _exhaustive: never = mutation
      return _exhaustive
    }
  }
}
