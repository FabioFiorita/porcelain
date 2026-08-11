import type {
  BoardCard,
  ClearBoardColumnInput,
  CreateBoardCardInput,
  CreateBoardCardOutput,
  DeleteBoardCardInput,
  MoveBoardCardInput,
  UpdateBoardCardInput,
} from '@porcelain/contracts/board'

/**
 * Pure Board optimistic transitions, rollback, and create reconciliation (BRD-003).
 *
 * No ambient clock or id generator — the adapter supplies `temporaryId` and `now`.
 * Daemon results remain authoritative; every mutation still requires the declared refetch.
 */

/** Adapter-provided values for create/move ordering. Never ambient Date.now or random. */
export type BoardOptimisticContext = {
  readonly temporaryId: string
  readonly now: number
}

/** Exact pre-mutation card collection for rollback. */
export type BoardOptimisticSnapshot = {
  readonly cards: readonly BoardCard[]
}

export type BoardMutationKey = 'create' | 'update' | 'move' | 'delete' | 'clearColumn'

type BoardMutationInputByKey = {
  create: CreateBoardCardInput
  update: UpdateBoardCardInput
  move: MoveBoardCardInput
  delete: DeleteBoardCardInput
  clearColumn: ClearBoardColumnInput
}

export type BoardOptimisticTransitionResult = {
  readonly cards: readonly BoardCard[]
  readonly snapshot: BoardOptimisticSnapshot
}

/**
 * Apply a pure optimistic transition. Returns the next collection and a snapshot of the
 * pre-mutation cards. Transitions against an absent id leave the collection unchanged.
 */
export function applyBoardOptimisticTransition<K extends BoardMutationKey>(
  cards: readonly BoardCard[],
  mutation: K,
  input: BoardMutationInputByKey[K],
  optimistic: BoardOptimisticContext,
): BoardOptimisticTransitionResult {
  const snapshot: BoardOptimisticSnapshot = { cards: cards.slice() }
  const next = transition(cards, mutation, input, optimistic)
  return { cards: next, snapshot }
}

/** Restore the exact pre-mutation card collection. */
export function rollbackBoardOptimisticTransition(
  snapshot: BoardOptimisticSnapshot,
): readonly BoardCard[] {
  return snapshot.cards
}

/**
 * Reconcile after a successful mutation. Create replaces the temporary card with the
 * canonical result when supplied; every other path returns the optimistic collection.
 * Authoritative refetch remains required regardless.
 */
export function reconcileBoardMutation(
  cards: readonly BoardCard[],
  mutation: BoardMutationKey,
  options: {
    readonly temporaryId?: string
    readonly result?: CreateBoardCardOutput
  } = {},
): readonly BoardCard[] {
  if (mutation !== 'create') {
    return cards
  }
  const temporaryId = options.temporaryId
  const result = options.result
  if (temporaryId === undefined || result === undefined) {
    return cards
  }
  return cards.map((card) => (card.id === temporaryId ? result : card))
}

function transition<K extends BoardMutationKey>(
  cards: readonly BoardCard[],
  mutation: K,
  input: BoardMutationInputByKey[K],
  optimistic: BoardOptimisticContext,
): readonly BoardCard[] {
  switch (mutation) {
    case 'create': {
      const createInput = input as CreateBoardCardInput
      const card: BoardCard = {
        id: optimistic.temporaryId,
        title: createInput.title,
        status: createInput.status ?? 'todo',
        order: optimistic.now,
        createdAt: optimistic.now,
        ...(createInput.body !== undefined ? { body: createInput.body } : {}),
      }
      return [...cards, card]
    }
    case 'update': {
      const updateInput = input as UpdateBoardCardInput
      if (!cards.some((card) => card.id === updateInput.cardId)) {
        return cards
      }
      return cards.map((card) => {
        if (card.id !== updateInput.cardId) return card
        return {
          ...card,
          ...(updateInput.title !== undefined ? { title: updateInput.title } : {}),
          ...(updateInput.body !== undefined ? { body: updateInput.body } : {}),
        }
      })
    }
    case 'move': {
      const moveInput = input as MoveBoardCardInput
      const moved = cards.find((card) => card.id === moveInput.cardId)
      if (moved === undefined) {
        return cards
      }
      const rest = cards.filter((card) => card.id !== moveInput.cardId)
      return [...rest, { ...moved, status: moveInput.status, order: optimistic.now }]
    }
    case 'delete': {
      const deleteInput = input as DeleteBoardCardInput
      if (!cards.some((card) => card.id === deleteInput.cardId)) {
        return cards
      }
      return cards.filter((card) => card.id !== deleteInput.cardId)
    }
    case 'clearColumn': {
      const clearInput = input as ClearBoardColumnInput
      return cards.filter((card) => card.status !== clearInput.status)
    }
    default: {
      const _exhaustive: never = mutation
      return _exhaustive
    }
  }
}
