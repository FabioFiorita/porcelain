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
import { onMutationError } from '@renderer/hooks/mutation-error'
import { useDaemonIdentity } from '@renderer/hooks/use-daemon-identity'
import type { DaemonScope } from '@renderer/lib/daemon-scope'
import { trpc } from '@renderer/lib/trpc'
import { randomId } from '@renderer/lib/utils'
import { useRepoStore } from '@renderer/stores/repo'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { boardCardsQueryKey } from './board-query-key'

/**
 * Board mutation adapter (BRD-004).
 *
 * Binds the five BRD-003 mutation definitions to Web tRPC/React Query with the full
 * cancel → snapshot → pure transition → mutate → rollback/reconcile → exact
 * invalidation lifecycle. Temporary ids and timestamps are supplied here only.
 *
 * Transport calls go through the vanilla tRPC client (not `trpc.<legacy>.useMutation`
 * procedure hooks) so the feature adapter owns the cache identity.
 */

export type NewCardInput = {
  title: string
  body?: string
  status?: BoardStatus
}

type MutationContext = {
  readonly queryKey: readonly unknown[]
  readonly snapshot: BoardOptimisticSnapshot
  readonly temporaryId?: string
}

function temporaryId(): string {
  return `optimistic-${randomId()}`
}

function mutationErrorMessage(error: unknown): string {
  if (error instanceof Error && error.message.length > 0) return error.message
  return 'Request failed'
}

/** Add/edit/move/delete/clear Board cards with reversible optimism. */
export function useBoardCardActions(): {
  add: (input: NewCardInput) => Promise<void>
  update: (id: string, fields: { title?: string; body?: string }) => Promise<void>
  move: (id: string, status: BoardStatus) => Promise<void>
  remove: (id: string) => Promise<void>
  clear: (status: BoardStatus) => Promise<void>
  isPending: boolean
} {
  const repo = useRepoStore((s) => s.repo)
  const daemon = useDaemonIdentity()
  const daemonScope: DaemonScope = { host: daemon.host, version: daemon.version }
  const queryClient = useQueryClient()
  const client = trpc.useUtils().client

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
    for (const identity of identities) {
      await queryClient.invalidateQueries({
        queryKey: boardCardsQueryKey(daemonScope, identity),
        exact: true,
      })
    }
  }

  const beginCreate = async (input: CreateBoardCardInput): Promise<MutationContext> => {
    const identity = cardsIdentity(boardMutations.create.affectedQueries(input))
    const queryKey = boardCardsQueryKey(daemonScope, identity)
    await queryClient.cancelQueries({ queryKey, exact: true })
    const current = queryClient.getQueryData<readonly BoardCard[]>(queryKey) ?? []
    const optimistic = { temporaryId: temporaryId(), now: Date.now() }
    const { cards, snapshot } = applyBoardOptimisticTransition(current, 'create', input, optimistic)
    queryClient.setQueryData(queryKey, cards)
    return { queryKey, snapshot, temporaryId: optimistic.temporaryId }
  }

  const beginUpdate = async (input: UpdateBoardCardInput): Promise<MutationContext> => {
    const identity = cardsIdentity(boardMutations.update.affectedQueries(input))
    const queryKey = boardCardsQueryKey(daemonScope, identity)
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
    const identity = cardsIdentity(boardMutations.move.affectedQueries(input))
    const queryKey = boardCardsQueryKey(daemonScope, identity)
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
    const identity = cardsIdentity(boardMutations.delete.affectedQueries(input))
    const queryKey = boardCardsQueryKey(daemonScope, identity)
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
    const identity = cardsIdentity(boardMutations.clearColumn.affectedQueries(input))
    const queryKey = boardCardsQueryKey(daemonScope, identity)
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

  // Procedure dispatch uses BRD-003 procedureName keys bound to the canonical client.
  const create = useMutation({
    mutationFn: (input: CreateBoardCardInput) => client.createBoardCard.mutate(input),
    onMutate: beginCreate,
    onError: (error, _vars, context): void => {
      rollback(context)
      onMutationError('Add card')({ message: mutationErrorMessage(error) })
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
    mutationFn: (input: UpdateBoardCardInput) => client.updateBoardCard.mutate(input),
    onMutate: beginUpdate,
    onError: (error, _vars, context): void => {
      rollback(context)
      onMutationError('Update card')({ message: mutationErrorMessage(error) })
    },
    onSettled: async (_d, _e, vars): Promise<void> => {
      if (vars && boardMutations.update.requiresAuthoritativeRefetch) {
        await invalidateAffected(boardMutations.update.affectedQueries(vars))
      }
    },
  })

  const move = useMutation({
    mutationFn: (input: MoveBoardCardInput) => client.moveBoardCard.mutate(input),
    onMutate: beginMove,
    onError: (error, _vars, context): void => {
      rollback(context)
      onMutationError('Move card')({ message: mutationErrorMessage(error) })
    },
    onSettled: async (_d, _e, vars): Promise<void> => {
      if (vars && boardMutations.move.requiresAuthoritativeRefetch) {
        await invalidateAffected(boardMutations.move.affectedQueries(vars))
      }
    },
  })

  const remove = useMutation({
    mutationFn: (input: DeleteBoardCardInput) => client.deleteBoardCard.mutate(input),
    onMutate: beginDelete,
    onError: (error, _vars, context): void => {
      rollback(context)
      onMutationError('Delete card')({ message: mutationErrorMessage(error) })
    },
    onSettled: async (_d, _e, vars): Promise<void> => {
      if (vars && boardMutations.delete.requiresAuthoritativeRefetch) {
        await invalidateAffected(boardMutations.delete.affectedQueries(vars))
      }
    },
  })

  const clearColumn = useMutation({
    mutationFn: (input: ClearBoardColumnInput) => client.clearBoardColumn.mutate(input),
    onMutate: beginClear,
    onError: (error, _vars, context): void => {
      rollback(context)
      onMutationError('Clear cards')({ message: mutationErrorMessage(error) })
    },
    onSettled: async (_d, _e, vars): Promise<void> => {
      if (vars && boardMutations.clearColumn.requiresAuthoritativeRefetch) {
        await invalidateAffected(boardMutations.clearColumn.affectedQueries(vars))
      }
    },
  })

  return {
    add: async (input: NewCardInput): Promise<void> => {
      if (!repo) return
      await create.mutateAsync({
        projectPath: repo.path,
        title: input.title,
        ...(input.body !== undefined ? { body: input.body } : {}),
        ...(input.status !== undefined ? { status: input.status } : {}),
      })
    },
    update: async (id: string, fields: { title?: string; body?: string }): Promise<void> => {
      if (!repo) return
      await update.mutateAsync({
        projectPath: repo.path,
        cardId: id,
        ...(fields.title !== undefined ? { title: fields.title } : {}),
        ...(fields.body !== undefined ? { body: fields.body } : {}),
      })
    },
    move: async (id: string, status: BoardStatus): Promise<void> => {
      if (!repo) return
      await move.mutateAsync({ projectPath: repo.path, cardId: id, status })
    },
    remove: async (id: string): Promise<void> => {
      if (!repo) return
      await remove.mutateAsync({ projectPath: repo.path, cardId: id })
    },
    clear: async (status: BoardStatus): Promise<void> => {
      if (!repo) return
      await clearColumn.mutateAsync({ projectPath: repo.path, status })
    },
    isPending:
      create.isPending ||
      update.isPending ||
      move.isPending ||
      remove.isPending ||
      clearColumn.isPending,
  }
}
