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

import { type DaemonClient, getDaemonClient } from '@/lib/daemon/client'
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
 *
 * Daemon scope is frozen per public-action invocation: environment id, transport client, and
 * repo path are captured before enqueue and carried in mutation variables so TanStack observer
 * updates after an environment switch cannot retarget an in-flight write.
 */

export type NewComment = {
  path: string
  body: string
  startLine?: number
  endLine?: number
  anchorText?: string
}

/** Immutable daemon + Project identity captured at public-action invocation. */
type CommentMutationScope = {
  readonly environmentId: string
  readonly client: DaemonClient
  readonly repoPath: string
}

type ScopedVars<TInput> = {
  readonly scope: CommentMutationScope
  readonly input: TInput
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

function commentsIdentity(
  identities: ReturnType<typeof reviewCommentMutations.add.affectedQueries>,
) {
  const identity = identities[0]
  if (identity === undefined) {
    throw new Error('Review comment mutation must declare the comments query identity')
  }
  return identity
}

async function invalidateAffected(
  queryClient: QueryClient,
  environmentId: string,
  identities: ReturnType<typeof reviewCommentMutations.add.affectedQueries>,
): Promise<void> {
  for (const identity of identities) {
    await queryClient.invalidateQueries({
      queryKey: reviewCommentsQueryKey(environmentId, identity.projectPath),
      exact: true,
    })
  }
}

/**
 * Cancel → snapshot → optional optimistic apply. When the list has never loaded
 * (`getQueryData` is `undefined`), skip `setQueryData` so a single write cannot seed a
 * partial list; settle still refetches.
 */
async function beginTransition(
  queryClient: QueryClient,
  scope: CommentMutationScope,
  key: keyof typeof reviewCommentMutations,
  input:
    | AddReviewCommentInput
    | EditReviewCommentInput
    | DeleteReviewCommentInput
    | ResolveReviewCommentInput
    | ClearResolvedReviewCommentsInput,
  options?: { temporaryId: string; now: number },
): Promise<MutationContext> {
  const identity = commentsIdentity(reviewCommentMutations[key].affectedQueries(input as never))
  const queryKey = reviewCommentsQueryKey(scope.environmentId, identity.projectPath)
  await queryClient.cancelQueries({ queryKey, exact: true })
  const current = queryClient.getQueryData<readonly ReviewComment[]>(queryKey)
  if (current === undefined) {
    return {
      queryKey,
      snapshot: undefined,
      ...(options?.temporaryId !== undefined ? { temporaryId: options.temporaryId } : {}),
    }
  }
  const optimistic = options ?? { temporaryId: temporaryId(), now: Date.now() }
  const { comments, snapshot } = applyReviewCommentOptimisticTransition(
    current,
    key,
    input as never,
    optimistic,
  )
  queryClient.setQueryData(queryKey, comments)
  return {
    queryKey,
    snapshot,
    ...(key === 'add' ? { temporaryId: optimistic.temporaryId } : {}),
  }
}

function rollback(queryClient: QueryClient, context: MutationContext | undefined): void {
  if (!context?.snapshot) return
  queryClient.setQueryData(
    context.queryKey,
    rollbackReviewCommentOptimisticTransition(context.snapshot),
  )
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

  /**
   * Capture paired environment + repo at the public-action boundary. Every later mutation
   * callback reads this frozen scope from variables, never the live hook environment.
   */
  const captureScope = (procedure: string): CommentMutationScope | null => {
    if (repo === null) return null
    requirePaired(environment, procedure)
    return {
      environmentId: environment.id,
      client: getDaemonClient(environment),
      repoPath: repo.path,
    }
  }

  const runSerially = <T>(scope: CommentMutationScope, run: () => Promise<T>): Promise<T> => {
    const queueKey = JSON.stringify(reviewCommentsQueryKey(scope.environmentId, scope.repoPath))
    return enqueueCommentMutation(queryClient, queueKey, run)
  }

  const add = useMutation({
    mutationFn: async ({
      scope,
      input,
    }: ScopedVars<AddReviewCommentInput>): Promise<ReviewComment> => {
      return callDaemon(scope.client, addProcedure, input)
    },
    onMutate: async ({ scope, input }): Promise<MutationContext> => {
      const optimistic = { temporaryId: temporaryId(), now: Date.now() }
      return beginTransition(queryClient, scope, 'add', input, optimistic)
    },
    onError: (_error, _vars, context): void => {
      rollback(queryClient, context)
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
        await invalidateAffected(
          queryClient,
          vars.scope.environmentId,
          reviewCommentMutations.add.affectedQueries(vars.input),
        )
      }
    },
  })

  const edit = useMutation({
    mutationFn: async ({ scope, input }: ScopedVars<EditReviewCommentInput>) => {
      return callDaemon(scope.client, editProcedure, input)
    },
    onMutate: async ({ scope, input }): Promise<MutationContext> => {
      return beginTransition(queryClient, scope, 'edit', input)
    },
    onError: (_error, _vars, context): void => {
      rollback(queryClient, context)
    },
    onSettled: async (_d, _e, vars): Promise<void> => {
      if (vars && reviewCommentMutations.edit.requiresAuthoritativeRefetch) {
        await invalidateAffected(
          queryClient,
          vars.scope.environmentId,
          reviewCommentMutations.edit.affectedQueries(vars.input),
        )
      }
    },
  })

  const remove = useMutation({
    mutationFn: async ({ scope, input }: ScopedVars<DeleteReviewCommentInput>) => {
      return callDaemon(scope.client, deleteProcedure, input)
    },
    onMutate: async ({ scope, input }): Promise<MutationContext> => {
      return beginTransition(queryClient, scope, 'delete', input)
    },
    onError: (_error, _vars, context): void => {
      rollback(queryClient, context)
    },
    onSettled: async (_d, _e, vars): Promise<void> => {
      if (vars && reviewCommentMutations.delete.requiresAuthoritativeRefetch) {
        await invalidateAffected(
          queryClient,
          vars.scope.environmentId,
          reviewCommentMutations.delete.affectedQueries(vars.input),
        )
      }
    },
  })

  const setResolved = useMutation({
    mutationFn: async ({ scope, input }: ScopedVars<ResolveReviewCommentInput>) => {
      return callDaemon(scope.client, setResolvedProcedure, input)
    },
    onMutate: async ({ scope, input }): Promise<MutationContext> => {
      return beginTransition(queryClient, scope, 'setResolved', input)
    },
    onError: (_error, _vars, context): void => {
      rollback(queryClient, context)
    },
    onSettled: async (_d, _e, vars): Promise<void> => {
      if (vars && reviewCommentMutations.setResolved.requiresAuthoritativeRefetch) {
        await invalidateAffected(
          queryClient,
          vars.scope.environmentId,
          reviewCommentMutations.setResolved.affectedQueries(vars.input),
        )
      }
    },
  })

  const clearResolved = useMutation({
    mutationFn: async ({ scope, input }: ScopedVars<ClearResolvedReviewCommentsInput>) => {
      return callDaemon(scope.client, clearResolvedProcedure, input)
    },
    onMutate: async ({ scope, input }): Promise<MutationContext> => {
      return beginTransition(queryClient, scope, 'clearResolved', input)
    },
    onError: (_error, _vars, context): void => {
      rollback(queryClient, context)
    },
    onSettled: async (_d, _e, vars): Promise<void> => {
      if (vars && reviewCommentMutations.clearResolved.requiresAuthoritativeRefetch) {
        await invalidateAffected(
          queryClient,
          vars.scope.environmentId,
          reviewCommentMutations.clearResolved.affectedQueries(vars.input),
        )
      }
    },
  })

  return {
    add: async (comment: NewComment): Promise<void> => {
      const scope = captureScope('addReviewComment')
      if (scope === null) return
      await runSerially(scope, async () => {
        await add.mutateAsync({
          scope,
          input: {
            repoPath: scope.repoPath,
            path: comment.path,
            body: comment.body,
            ...(comment.startLine !== undefined ? { startLine: comment.startLine } : {}),
            ...(comment.endLine !== undefined ? { endLine: comment.endLine } : {}),
            ...(comment.anchorText !== undefined ? { anchorText: comment.anchorText } : {}),
          },
        })
      })
    },
    clearResolved: async (): Promise<void> => {
      const scope = captureScope('clearResolvedReviewComments')
      if (scope === null) return
      await runSerially(scope, async () => {
        await clearResolved.mutateAsync({
          scope,
          input: { repoPath: scope.repoPath },
        })
      })
    },
    edit: async (id: string, body: string): Promise<void> => {
      const scope = captureScope('editReviewComment')
      if (scope === null) return
      await runSerially(scope, async () => {
        await edit.mutateAsync({
          scope,
          input: { repoPath: scope.repoPath, id, body },
        })
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
      const scope = captureScope('deleteReviewComment')
      if (scope === null) return
      await runSerially(scope, async () => {
        await remove.mutateAsync({
          scope,
          input: { repoPath: scope.repoPath, id },
        })
      })
    },
    setResolved: async (id: string, resolved: boolean): Promise<void> => {
      const scope = captureScope('resolveReviewComment')
      if (scope === null) return
      await runSerially(scope, async () => {
        await setResolved.mutateAsync({
          scope,
          input: { repoPath: scope.repoPath, id, resolved },
        })
      })
    },
  }
}
