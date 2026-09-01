import {
  applyReviewCommentOptimisticTransition,
  type ReviewCommentOptimisticSnapshot,
  reconcileReviewCommentMutation,
  reviewCommentMutations,
  rollbackReviewCommentOptimisticTransition,
} from '@porcelain/client-runtime/review'
import type {
  AddReviewCommentInput,
  ClearResolvedReviewCommentsInput,
  DeleteReviewCommentInput,
  EditReviewCommentInput,
  ResolveReviewCommentInput,
  ReviewComment,
} from '@porcelain/contracts/review'
import { onMutationError } from '@renderer/hooks/mutation-error'
import { hubOwnerClient, useHubRepoOwner } from '@renderer/hooks/use-hub-owner'
import { randomId } from '@renderer/lib/utils'
import { type QueryClient, useMutation, useQueryClient } from '@tanstack/react-query'
import { reviewCommentsKeyForProject, reviewCommentsQueryKey } from './comment-query-key'

/**
 * Review comment mutation adapter (RVC-003).
 *
 * Binds the five RVC-002 mutation definitions to Web tRPC/React Query with the full
 * cancel → snapshot → (load-gated) pure transition → mutate → rollback/reconcile → exact
 * invalidation lifecycle. Temporary ids and timestamps are supplied here only.
 *
 * Optimism is gated: if the comments list has never loaded, do not seed the cache from a
 * single write (legacy behavior). Transport calls go through the vanilla tRPC client.
 */

export type NewComment = {
  path: string
  startLine?: number
  endLine?: number
  anchorText?: string
  body: string
}

type MutationContext = {
  readonly queryKey: readonly unknown[]
  readonly snapshot: ReviewCommentOptimisticSnapshot | undefined
  readonly temporaryId?: string
}

function temporaryId(): string {
  return `optimistic-${randomId()}`
}

function mutationErrorMessage(error: unknown): string {
  if (error instanceof Error && error.message.length > 0) return error.message
  return 'Request failed'
}

const mutationQueues = new WeakMap<QueryClient, Map<string, Promise<void>>>()

/**
 * Queue tail: sequencing only. The rejection belongs to whoever awaits the returned
 * `result`; the stored tail must settle either way so the next mutation still runs.
 */
async function queueTail(promise: Promise<unknown>): Promise<void> {
  try {
    await promise
  } catch {
    // Already owned by the caller awaiting `result` — the queue only needs the order.
  }
}

function enqueueCommentMutation<T>(
  queryClient: QueryClient,
  queueKey: string,
  run: () => Promise<T>,
): Promise<T> {
  let queues = mutationQueues.get(queryClient)
  if (queues === undefined) {
    queues = new Map()
    mutationQueues.set(queryClient, queues)
  }
  const previous = queues.get(queueKey) ?? Promise.resolve()
  const result = previous.then(run, run)
  queues.set(queueKey, queueTail(result))
  return result
}

/** Add/edit/delete/resolve/clear review comments with reversible, load-gated optimism. */
export function useCommentActions(): {
  add: (input: NewComment) => Promise<void>
  edit: (id: string, body: string) => Promise<void>
  remove: (id: string) => Promise<void>
  setResolved: (id: string, resolved: boolean) => Promise<void>
  clearResolved: () => Promise<void>
} {
  const { repoPath, daemon: daemonScope, owner } = useHubRepoOwner()
  const queryClient = useQueryClient()
  const client = hubOwnerClient

  const runSerially = <T>(run: () => Promise<T>): Promise<T> => {
    if (repoPath === null) return run()
    const queueKey = JSON.stringify(reviewCommentsKeyForProject(daemonScope, repoPath))
    return enqueueCommentMutation(queryClient, queueKey, run)
  }

  const commentsIdentity = (
    identities: ReturnType<typeof reviewCommentMutations.add.affectedQueries>,
  ) => {
    const identity = identities[0]
    if (identity === undefined) {
      throw new Error('Review comment mutation must declare the comments query identity')
    }
    return identity
  }

  const invalidateAffected = async (
    identities: ReturnType<typeof reviewCommentMutations.add.affectedQueries>,
  ): Promise<void> => {
    for (const identity of identities) {
      await queryClient.invalidateQueries({
        queryKey: reviewCommentsQueryKey(daemonScope, identity),
        exact: true,
      })
    }
  }

  /**
   * Cancel → snapshot → optional optimistic apply. When the list has never loaded
   * (`getQueryData` is `undefined`), skip `setQueryData` so a single write cannot seed a
   * partial list; settle still refetches.
   */
  const beginAdd = async (input: AddReviewCommentInput): Promise<MutationContext> => {
    const identity = commentsIdentity(reviewCommentMutations.add.affectedQueries(input))
    const queryKey = reviewCommentsQueryKey(daemonScope, identity)
    await queryClient.cancelQueries({ queryKey, exact: true })
    const current = queryClient.getQueryData<readonly ReviewComment[]>(queryKey)
    const optimistic = { temporaryId: temporaryId(), now: Date.now() }
    if (current === undefined) {
      return { queryKey, snapshot: undefined, temporaryId: optimistic.temporaryId }
    }
    const { comments, snapshot } = applyReviewCommentOptimisticTransition(
      current,
      'add',
      input,
      optimistic,
    )
    queryClient.setQueryData(queryKey, comments)
    return { queryKey, snapshot, temporaryId: optimistic.temporaryId }
  }

  const beginEdit = async (input: EditReviewCommentInput): Promise<MutationContext> => {
    const identity = commentsIdentity(reviewCommentMutations.edit.affectedQueries(input))
    const queryKey = reviewCommentsQueryKey(daemonScope, identity)
    await queryClient.cancelQueries({ queryKey, exact: true })
    const current = queryClient.getQueryData<readonly ReviewComment[]>(queryKey)
    if (current === undefined) return { queryKey, snapshot: undefined }
    const { comments, snapshot } = applyReviewCommentOptimisticTransition(current, 'edit', input, {
      temporaryId: temporaryId(),
      now: Date.now(),
    })
    queryClient.setQueryData(queryKey, comments)
    return { queryKey, snapshot }
  }

  const beginDelete = async (input: DeleteReviewCommentInput): Promise<MutationContext> => {
    const identity = commentsIdentity(reviewCommentMutations.delete.affectedQueries(input))
    const queryKey = reviewCommentsQueryKey(daemonScope, identity)
    await queryClient.cancelQueries({ queryKey, exact: true })
    const current = queryClient.getQueryData<readonly ReviewComment[]>(queryKey)
    if (current === undefined) return { queryKey, snapshot: undefined }
    const { comments, snapshot } = applyReviewCommentOptimisticTransition(
      current,
      'delete',
      input,
      { temporaryId: temporaryId(), now: Date.now() },
    )
    queryClient.setQueryData(queryKey, comments)
    return { queryKey, snapshot }
  }

  const beginSetResolved = async (input: ResolveReviewCommentInput): Promise<MutationContext> => {
    const identity = commentsIdentity(reviewCommentMutations.setResolved.affectedQueries(input))
    const queryKey = reviewCommentsQueryKey(daemonScope, identity)
    await queryClient.cancelQueries({ queryKey, exact: true })
    const current = queryClient.getQueryData<readonly ReviewComment[]>(queryKey)
    if (current === undefined) return { queryKey, snapshot: undefined }
    const { comments, snapshot } = applyReviewCommentOptimisticTransition(
      current,
      'setResolved',
      input,
      { temporaryId: temporaryId(), now: Date.now() },
    )
    queryClient.setQueryData(queryKey, comments)
    return { queryKey, snapshot }
  }

  const beginClearResolved = async (
    input: ClearResolvedReviewCommentsInput,
  ): Promise<MutationContext> => {
    const identity = commentsIdentity(reviewCommentMutations.clearResolved.affectedQueries(input))
    const queryKey = reviewCommentsQueryKey(daemonScope, identity)
    await queryClient.cancelQueries({ queryKey, exact: true })
    const current = queryClient.getQueryData<readonly ReviewComment[]>(queryKey)
    if (current === undefined) return { queryKey, snapshot: undefined }
    const { comments, snapshot } = applyReviewCommentOptimisticTransition(
      current,
      'clearResolved',
      input,
      { temporaryId: temporaryId(), now: Date.now() },
    )
    queryClient.setQueryData(queryKey, comments)
    return { queryKey, snapshot }
  }

  const rollback = (context: MutationContext | undefined): void => {
    if (!context?.snapshot) return
    queryClient.setQueryData(
      context.queryKey,
      rollbackReviewCommentOptimisticTransition(context.snapshot),
    )
  }

  const add = useMutation({
    mutationFn: (input: AddReviewCommentInput) => client(owner).addReviewComment.mutate(input),
    onMutate: beginAdd,
    onError: (error, _vars, context): void => {
      rollback(context)
      onMutationError('Add comment')({ message: mutationErrorMessage(error) })
    },
    onSuccess: (result: ReviewComment, _vars, context): void => {
      if (!context?.temporaryId) return
      queryClient.setQueryData(
        context.queryKey,
        (current: readonly ReviewComment[] | undefined) => {
          if (!current) return current
          return reconcileReviewCommentMutation(current, 'add', {
            temporaryId: context.temporaryId,
            result,
          })
        },
      )
    },
    onSettled: async (_d, _e, vars): Promise<void> => {
      if (vars && reviewCommentMutations.add.requiresAuthoritativeRefetch) {
        await invalidateAffected(reviewCommentMutations.add.affectedQueries(vars))
      }
    },
  })

  const edit = useMutation({
    mutationFn: (input: EditReviewCommentInput) => client(owner).editReviewComment.mutate(input),
    onMutate: beginEdit,
    onError: (error, _vars, context): void => {
      rollback(context)
      onMutationError('Edit comment')({ message: mutationErrorMessage(error) })
    },
    onSettled: async (_d, _e, vars): Promise<void> => {
      if (vars && reviewCommentMutations.edit.requiresAuthoritativeRefetch) {
        await invalidateAffected(reviewCommentMutations.edit.affectedQueries(vars))
      }
    },
  })

  const remove = useMutation({
    mutationFn: (input: DeleteReviewCommentInput) =>
      client(owner).deleteReviewComment.mutate(input),
    onMutate: beginDelete,
    onError: (error, _vars, context): void => {
      rollback(context)
      onMutationError('Delete comment')({ message: mutationErrorMessage(error) })
    },
    onSettled: async (_d, _e, vars): Promise<void> => {
      if (vars && reviewCommentMutations.delete.requiresAuthoritativeRefetch) {
        await invalidateAffected(reviewCommentMutations.delete.affectedQueries(vars))
      }
    },
  })

  const setResolved = useMutation({
    mutationFn: (input: ResolveReviewCommentInput) =>
      client(owner).resolveReviewComment.mutate(input),
    onMutate: beginSetResolved,
    onError: (error, _vars, context): void => {
      rollback(context)
      onMutationError('Resolve comment')({ message: mutationErrorMessage(error) })
    },
    onSettled: async (_d, _e, vars): Promise<void> => {
      if (vars && reviewCommentMutations.setResolved.requiresAuthoritativeRefetch) {
        await invalidateAffected(reviewCommentMutations.setResolved.affectedQueries(vars))
      }
    },
  })

  const clearResolved = useMutation({
    mutationFn: (input: ClearResolvedReviewCommentsInput) =>
      client(owner).clearResolvedReviewComments.mutate(input),
    onMutate: beginClearResolved,
    onError: (error, _vars, context): void => {
      rollback(context)
      onMutationError('Clear closed comments')({ message: mutationErrorMessage(error) })
    },
    onSettled: async (_d, _e, vars): Promise<void> => {
      if (vars && reviewCommentMutations.clearResolved.requiresAuthoritativeRefetch) {
        await invalidateAffected(reviewCommentMutations.clearResolved.affectedQueries(vars))
      }
    },
  })

  return {
    add: async (input: NewComment): Promise<void> => {
      if (repoPath === null) return
      await runSerially(async () => {
        await add.mutateAsync({
          repoPath,
          path: input.path,
          body: input.body,
          ...(input.startLine !== undefined ? { startLine: input.startLine } : {}),
          ...(input.endLine !== undefined ? { endLine: input.endLine } : {}),
          ...(input.anchorText !== undefined ? { anchorText: input.anchorText } : {}),
        })
      })
    },
    edit: async (id: string, body: string): Promise<void> => {
      if (repoPath === null) return
      await runSerially(async () => {
        await edit.mutateAsync({ repoPath, id, body })
      })
    },
    remove: async (id: string): Promise<void> => {
      if (repoPath === null) return
      await runSerially(async () => {
        await remove.mutateAsync({ repoPath, id })
      })
    },
    setResolved: async (id: string, resolved: boolean): Promise<void> => {
      if (repoPath === null) return
      await runSerially(async () => {
        await setResolved.mutateAsync({ repoPath, id, resolved })
      })
    },
    clearResolved: async (): Promise<void> => {
      if (repoPath === null) return
      await runSerially(async () => {
        await clearResolved.mutateAsync({ repoPath })
      })
    },
  }
}
