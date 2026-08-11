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
import { type QueryClient, useMutation, useQueryClient } from '@tanstack/react-query'

import { getDaemonClient } from '@/lib/daemon/client'
import { isPaired } from '@/lib/daemon/environment'
import { useActiveEnvironment } from '@/lib/daemon/environments-store'
import { DaemonError } from '@/lib/daemon/errors'
import { callDaemon, namedContractProcedure } from '@/lib/daemon/procedure'
import { useActiveRepo } from '@/lib/daemon/repo'

import { reviewCommentsQueryKey } from './comment-query-key'

/**
 * Review comment mutation adapter (RVC-004).
 *
 * Binds the five RVC-002 mutation definitions to mobile transport/React Query with the full
 * cancel → snapshot → load-gated apply → mutate → rollback/reconcile → exact invalidation
 * lifecycle, plus per-identity serial concurrency (Web correction 81d91ef). Temporary ids and
 * timestamps are supplied only here.
 */

export type NewComment = {
  path: string
  body: string
  startLine?: number
  endLine?: number
  anchorText?: string
}

type MutationContext = {
  readonly queryKey: readonly unknown[]
  readonly snapshot: ReviewCommentOptimisticSnapshot | undefined
  readonly temporaryId?: string
}

const addProcedure = namedContractProcedure(
  reviewCommentMutations.add.procedureName,
  reviewCommentMutations.add.procedure,
)
const editProcedure = namedContractProcedure(
  reviewCommentMutations.edit.procedureName,
  reviewCommentMutations.edit.procedure,
)
const deleteProcedure = namedContractProcedure(
  reviewCommentMutations.delete.procedureName,
  reviewCommentMutations.delete.procedure,
)
const setResolvedProcedure = namedContractProcedure(
  reviewCommentMutations.setResolved.procedureName,
  reviewCommentMutations.setResolved.procedure,
)
const clearResolvedProcedure = namedContractProcedure(
  reviewCommentMutations.clearResolved.procedureName,
  reviewCommentMutations.clearResolved.procedure,
)

function temporaryId(): string {
  return `optimistic-${globalThis.crypto.randomUUID()}`
}

const mutationQueues = new WeakMap<QueryClient, Map<string, Promise<void>>>()

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
  queues.set(
    queueKey,
    result.then(
      () => undefined,
      () => undefined,
    ),
  )
  return result
}

function requirePaired(
  environment: ReturnType<typeof useActiveEnvironment>,
  procedure: string,
): asserts environment is NonNullable<ReturnType<typeof useActiveEnvironment>> & {
  token: string
} {
  if (!isPaired(environment)) {
    throw new DaemonError('unreachable', procedure, 'No daemon is paired with this device.')
  }
}

/** Add/edit/delete/resolve/clear review comments with reversible, load-gated optimism. */
export function useCommentActions(): {
  add: (comment: NewComment) => Promise<void>
  edit: (id: string, body: string) => Promise<void>
  remove: (id: string) => Promise<void>
  setResolved: (id: string, resolved: boolean) => Promise<void>
  clearResolved: () => Promise<void>
  isPending: boolean
  error: Error | null
} {
  const repo = useActiveRepo()
  const environment = useActiveEnvironment()
  const queryClient = useQueryClient()

  const runSerially = <T>(run: () => Promise<T>): Promise<T> => {
    if (repo === null || !isPaired(environment)) return run()
    const queueKey = JSON.stringify(reviewCommentsQueryKey(environment.id, repo.path))
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
    if (!isPaired(environment)) return
    for (const identity of identities) {
      await queryClient.invalidateQueries({
        queryKey: reviewCommentsQueryKey(environment.id, identity.projectPath),
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
    requirePaired(environment, 'addReviewComment')
    const identity = commentsIdentity(reviewCommentMutations.add.affectedQueries(input))
    const queryKey = reviewCommentsQueryKey(environment.id, identity.projectPath)
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
    requirePaired(environment, 'editReviewComment')
    const identity = commentsIdentity(reviewCommentMutations.edit.affectedQueries(input))
    const queryKey = reviewCommentsQueryKey(environment.id, identity.projectPath)
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
    requirePaired(environment, 'deleteReviewComment')
    const identity = commentsIdentity(reviewCommentMutations.delete.affectedQueries(input))
    const queryKey = reviewCommentsQueryKey(environment.id, identity.projectPath)
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
    requirePaired(environment, 'resolveReviewComment')
    const identity = commentsIdentity(reviewCommentMutations.setResolved.affectedQueries(input))
    const queryKey = reviewCommentsQueryKey(environment.id, identity.projectPath)
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
    requirePaired(environment, 'clearResolvedReviewComments')
    const identity = commentsIdentity(reviewCommentMutations.clearResolved.affectedQueries(input))
    const queryKey = reviewCommentsQueryKey(environment.id, identity.projectPath)
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
    mutationFn: async (input: AddReviewCommentInput): Promise<ReviewComment> => {
      requirePaired(environment, 'addReviewComment')
      return callDaemon(getDaemonClient(environment), addProcedure, input)
    },
    onMutate: beginAdd,
    onError: (_error, _vars, context): void => {
      rollback(context)
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
    mutationFn: async (input: EditReviewCommentInput) => {
      requirePaired(environment, 'editReviewComment')
      return callDaemon(getDaemonClient(environment), editProcedure, input)
    },
    onMutate: beginEdit,
    onError: (_error, _vars, context): void => {
      rollback(context)
    },
    onSettled: async (_d, _e, vars): Promise<void> => {
      if (vars && reviewCommentMutations.edit.requiresAuthoritativeRefetch) {
        await invalidateAffected(reviewCommentMutations.edit.affectedQueries(vars))
      }
    },
  })

  const remove = useMutation({
    mutationFn: async (input: DeleteReviewCommentInput) => {
      requirePaired(environment, 'deleteReviewComment')
      return callDaemon(getDaemonClient(environment), deleteProcedure, input)
    },
    onMutate: beginDelete,
    onError: (_error, _vars, context): void => {
      rollback(context)
    },
    onSettled: async (_d, _e, vars): Promise<void> => {
      if (vars && reviewCommentMutations.delete.requiresAuthoritativeRefetch) {
        await invalidateAffected(reviewCommentMutations.delete.affectedQueries(vars))
      }
    },
  })

  const setResolved = useMutation({
    mutationFn: async (input: ResolveReviewCommentInput) => {
      requirePaired(environment, 'resolveReviewComment')
      return callDaemon(getDaemonClient(environment), setResolvedProcedure, input)
    },
    onMutate: beginSetResolved,
    onError: (_error, _vars, context): void => {
      rollback(context)
    },
    onSettled: async (_d, _e, vars): Promise<void> => {
      if (vars && reviewCommentMutations.setResolved.requiresAuthoritativeRefetch) {
        await invalidateAffected(reviewCommentMutations.setResolved.affectedQueries(vars))
      }
    },
  })

  const clearResolved = useMutation({
    mutationFn: async (input: ClearResolvedReviewCommentsInput) => {
      requirePaired(environment, 'clearResolvedReviewComments')
      return callDaemon(getDaemonClient(environment), clearResolvedProcedure, input)
    },
    onMutate: beginClearResolved,
    onError: (_error, _vars, context): void => {
      rollback(context)
    },
    onSettled: async (_d, _e, vars): Promise<void> => {
      if (vars && reviewCommentMutations.clearResolved.requiresAuthoritativeRefetch) {
        await invalidateAffected(reviewCommentMutations.clearResolved.affectedQueries(vars))
      }
    },
  })

  return {
    add: async (comment: NewComment): Promise<void> => {
      if (repo === null) return
      await runSerially(async () => {
        await add.mutateAsync({
          repoPath: repo.path,
          path: comment.path,
          body: comment.body,
          ...(comment.startLine !== undefined ? { startLine: comment.startLine } : {}),
          ...(comment.endLine !== undefined ? { endLine: comment.endLine } : {}),
          ...(comment.anchorText !== undefined ? { anchorText: comment.anchorText } : {}),
        })
      })
    },
    clearResolved: async (): Promise<void> => {
      if (repo === null) return
      await runSerially(async () => {
        await clearResolved.mutateAsync({ repoPath: repo.path })
      })
    },
    edit: async (id: string, body: string): Promise<void> => {
      if (repo === null) return
      await runSerially(async () => {
        await edit.mutateAsync({ repoPath: repo.path, id, body })
      })
    },
    error: add.error ?? edit.error ?? remove.error ?? setResolved.error ?? clearResolved.error,
    isPending:
      add.isPending ||
      edit.isPending ||
      remove.isPending ||
      setResolved.isPending ||
      clearResolved.isPending,
    remove: async (id: string): Promise<void> => {
      if (repo === null) return
      await runSerially(async () => {
        await remove.mutateAsync({ repoPath: repo.path, id })
      })
    },
    setResolved: async (id: string, resolved: boolean): Promise<void> => {
      if (repo === null) return
      await runSerially(async () => {
        await setResolved.mutateAsync({ repoPath: repo.path, id, resolved })
      })
    },
  }
}
