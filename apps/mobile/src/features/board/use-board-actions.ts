import {
  applyBoardOptimisticTransition,
  type BoardOptimisticSnapshot,
  boardMutations,
  reconcileBoardMutation,
  rollbackBoardOptimisticTransition,
} from '@porcelain/client-runtime/board'
import type {
  BoardCard,
  BoardStatus,
  ClearBoardColumnInput,
  CreateBoardCardInput,
  CreateBoardCardOutput,
  DeleteBoardCardInput,
  MoveBoardCardInput,
  UpdateBoardCardInput,
} from '@porcelain/contracts/board'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useActiveProject } from '@/features/projects'
import { isPaired, useActiveEnvironment } from '@/features/remote'
import { getDaemonClient } from '@/lib/daemon/client'
import { DaemonError } from '@/lib/daemon/errors'
import { callDaemon, namedContractProcedure } from '@/lib/daemon/procedure'

import { boardCardsQueryKey } from './board-query-key'

/**
 * Board mutation adapter (BRD-005).
 *
 * Binds the five BRD-003 mutation definitions to mobile transport/React Query with the full
 * cancel → snapshot → pure transition → mutate → rollback/reconcile → exact invalidation
 * lifecycle. Temporary ids and timestamps are supplied only here.
 */

export type CardActions = {
  add: (input: { title: string; body?: string; status: BoardStatus }) => Promise<void>
  update: (id: string, fields: { title: string; body: string }) => Promise<void>
  move: (id: string, status: BoardStatus) => Promise<void>
  remove: (id: string) => Promise<void>
  clear: (status: BoardStatus) => Promise<void>
}

type MutationContext = {
  readonly queryKey: readonly unknown[]
  readonly snapshot: BoardOptimisticSnapshot
  readonly temporaryId?: string
}

const createBoardCardProcedure = namedContractProcedure(
  boardMutations.create.procedureName,
  boardMutations.create.procedure,
)

const updateBoardCardProcedure = namedContractProcedure(
  boardMutations.update.procedureName,
  boardMutations.update.procedure,
)

const moveBoardCardProcedure = namedContractProcedure(
  boardMutations.move.procedureName,
  boardMutations.move.procedure,
)

const deleteBoardCardProcedure = namedContractProcedure(
  boardMutations.delete.procedureName,
  boardMutations.delete.procedure,
)

const clearBoardColumnProcedure = namedContractProcedure(
  boardMutations.clearColumn.procedureName,
  boardMutations.clearColumn.procedure,
)

function temporaryId(): string {
  return `optimistic-${globalThis.crypto.randomUUID()}`
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

/** Add, edit, move, delete, and bulk-clear cards with reversible optimism (BRD-003 lifecycle). */
export function useBoardCardActions(): CardActions {
  const project = useActiveProject()
  const environment = useActiveEnvironment()
  const queryClient = useQueryClient()

  const cardsIdentity = (identities: ReturnType<typeof boardMutations.create.affectedQueries>) => {
    const identity = identities[0]
    if (identity === undefined) {
      throw new Error('Board mutation must declare the cards query identity')
    }
    return identity
  }

  const invalidateAffected = async (
    identities: ReturnType<typeof boardMutations.create.affectedQueries>,
  ): Promise<void> => {
    if (!isPaired(environment)) return
    for (const identity of identities) {
      await queryClient.invalidateQueries({
        queryKey: boardCardsQueryKey(environment.id, identity.projectPath),
        exact: true,
      })
    }
  }

  const beginCreate = async (input: CreateBoardCardInput): Promise<MutationContext> => {
    requirePaired(environment, 'createBoardCard')
    const identity = cardsIdentity(boardMutations.create.affectedQueries(input))
    const queryKey = boardCardsQueryKey(environment.id, identity.projectPath)
    await queryClient.cancelQueries({ queryKey, exact: true })
    const current = queryClient.getQueryData<readonly BoardCard[]>(queryKey) ?? []
    const optimistic = { temporaryId: temporaryId(), now: Date.now() }
    const { cards, snapshot } = applyBoardOptimisticTransition(current, 'create', input, optimistic)
    queryClient.setQueryData(queryKey, cards)
    return { queryKey, snapshot, temporaryId: optimistic.temporaryId }
  }

  const beginUpdate = async (input: UpdateBoardCardInput): Promise<MutationContext> => {
    requirePaired(environment, 'updateBoardCard')
    const identity = cardsIdentity(boardMutations.update.affectedQueries(input))
    const queryKey = boardCardsQueryKey(environment.id, identity.projectPath)
    await queryClient.cancelQueries({ queryKey, exact: true })
    const current = queryClient.getQueryData<readonly BoardCard[]>(queryKey) ?? []
    const { cards, snapshot } = applyBoardOptimisticTransition(current, 'update', input, {
      temporaryId: temporaryId(),
      now: Date.now(),
    })
    queryClient.setQueryData(queryKey, cards)
    return { queryKey, snapshot }
  }

  const beginMove = async (input: MoveBoardCardInput): Promise<MutationContext> => {
    requirePaired(environment, 'moveBoardCard')
    const identity = cardsIdentity(boardMutations.move.affectedQueries(input))
    const queryKey = boardCardsQueryKey(environment.id, identity.projectPath)
    await queryClient.cancelQueries({ queryKey, exact: true })
    const current = queryClient.getQueryData<readonly BoardCard[]>(queryKey) ?? []
    const { cards, snapshot } = applyBoardOptimisticTransition(current, 'move', input, {
      temporaryId: temporaryId(),
      now: Date.now(),
    })
    queryClient.setQueryData(queryKey, cards)
    return { queryKey, snapshot }
  }

  const beginDelete = async (input: DeleteBoardCardInput): Promise<MutationContext> => {
    requirePaired(environment, 'deleteBoardCard')
    const identity = cardsIdentity(boardMutations.delete.affectedQueries(input))
    const queryKey = boardCardsQueryKey(environment.id, identity.projectPath)
    await queryClient.cancelQueries({ queryKey, exact: true })
    const current = queryClient.getQueryData<readonly BoardCard[]>(queryKey) ?? []
    const { cards, snapshot } = applyBoardOptimisticTransition(current, 'delete', input, {
      temporaryId: temporaryId(),
      now: Date.now(),
    })
    queryClient.setQueryData(queryKey, cards)
    return { queryKey, snapshot }
  }

  const beginClear = async (input: ClearBoardColumnInput): Promise<MutationContext> => {
    requirePaired(environment, 'clearBoardColumn')
    const identity = cardsIdentity(boardMutations.clearColumn.affectedQueries(input))
    const queryKey = boardCardsQueryKey(environment.id, identity.projectPath)
    await queryClient.cancelQueries({ queryKey, exact: true })
    const current = queryClient.getQueryData<readonly BoardCard[]>(queryKey) ?? []
    const { cards, snapshot } = applyBoardOptimisticTransition(current, 'clearColumn', input, {
      temporaryId: temporaryId(),
      now: Date.now(),
    })
    queryClient.setQueryData(queryKey, cards)
    return { queryKey, snapshot }
  }

  const rollback = (context: MutationContext | undefined): void => {
    if (!context) return
    queryClient.setQueryData(context.queryKey, rollbackBoardOptimisticTransition(context.snapshot))
  }

  const create = useMutation({
    mutationFn: async (input: CreateBoardCardInput): Promise<CreateBoardCardOutput> => {
      requirePaired(environment, 'createBoardCard')
      return callDaemon(getDaemonClient(environment), createBoardCardProcedure, input)
    },
    onMutate: beginCreate,
    onError: (_error, _vars, context): void => {
      rollback(context)
    },
    onSuccess: (result: CreateBoardCardOutput, _vars, context): void => {
      if (!context?.temporaryId) return
      queryClient.setQueryData(context.queryKey, (current: readonly BoardCard[] | undefined) => {
        if (!current) return current
        return reconcileBoardMutation(current, 'create', {
          temporaryId: context.temporaryId,
          result,
        })
      })
    },
    onSettled: async (_d, _e, vars): Promise<void> => {
      if (vars && boardMutations.create.requiresAuthoritativeRefetch) {
        await invalidateAffected(boardMutations.create.affectedQueries(vars))
      }
    },
  })

  const update = useMutation({
    mutationFn: async (input: UpdateBoardCardInput) => {
      requirePaired(environment, 'updateBoardCard')
      return callDaemon(getDaemonClient(environment), updateBoardCardProcedure, input)
    },
    onMutate: beginUpdate,
    onError: (_error, _vars, context): void => {
      rollback(context)
    },
    onSettled: async (_d, _e, vars): Promise<void> => {
      if (vars && boardMutations.update.requiresAuthoritativeRefetch) {
        await invalidateAffected(boardMutations.update.affectedQueries(vars))
      }
    },
  })

  const move = useMutation({
    mutationFn: async (input: MoveBoardCardInput) => {
      requirePaired(environment, 'moveBoardCard')
      return callDaemon(getDaemonClient(environment), moveBoardCardProcedure, input)
    },
    onMutate: beginMove,
    onError: (_error, _vars, context): void => {
      rollback(context)
    },
    onSettled: async (_d, _e, vars): Promise<void> => {
      if (vars && boardMutations.move.requiresAuthoritativeRefetch) {
        await invalidateAffected(boardMutations.move.affectedQueries(vars))
      }
    },
  })

  const remove = useMutation({
    mutationFn: async (input: DeleteBoardCardInput) => {
      requirePaired(environment, 'deleteBoardCard')
      return callDaemon(getDaemonClient(environment), deleteBoardCardProcedure, input)
    },
    onMutate: beginDelete,
    onError: (_error, _vars, context): void => {
      rollback(context)
    },
    onSettled: async (_d, _e, vars): Promise<void> => {
      if (vars && boardMutations.delete.requiresAuthoritativeRefetch) {
        await invalidateAffected(boardMutations.delete.affectedQueries(vars))
      }
    },
  })

  const clearColumn = useMutation({
    mutationFn: async (input: ClearBoardColumnInput) => {
      requirePaired(environment, 'clearBoardColumn')
      return callDaemon(getDaemonClient(environment), clearBoardColumnProcedure, input)
    },
    onMutate: beginClear,
    onError: (_error, _vars, context): void => {
      rollback(context)
    },
    onSettled: async (_d, _e, vars): Promise<void> => {
      if (vars && boardMutations.clearColumn.requiresAuthoritativeRefetch) {
        await invalidateAffected(boardMutations.clearColumn.affectedQueries(vars))
      }
    },
  })

  return {
    add: async (input): Promise<void> => {
      if (project === null) return
      await create.mutateAsync({
        projectPath: project.path,
        title: input.title,
        status: input.status,
        ...(input.body === undefined ? {} : { body: input.body }),
      })
    },
    clear: async (status): Promise<void> => {
      if (project === null) return
      await clearColumn.mutateAsync({ projectPath: project.path, status })
    },
    move: async (id, status): Promise<void> => {
      if (project === null) return
      await move.mutateAsync({ projectPath: project.path, cardId: id, status })
    },
    remove: async (id): Promise<void> => {
      if (project === null) return
      await remove.mutateAsync({ projectPath: project.path, cardId: id })
    },
    update: async (id, fields): Promise<void> => {
      if (project === null) return
      await update.mutateAsync({
        projectPath: project.path,
        cardId: id,
        title: fields.title,
        body: fields.body,
      })
    },
  }
}
