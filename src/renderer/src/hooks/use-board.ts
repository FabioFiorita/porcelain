import type { BoardCard, CardStatus } from '@backend/board-store'
import { onMutationError } from '@renderer/hooks/mutation-error'
import { trpc } from '@renderer/lib/trpc'
import { randomId } from '@renderer/lib/utils'
import { useRepoStore } from '@renderer/stores/repo'

/** The three columns, in order, with their display labels. */
export const BOARD_COLUMNS: { status: CardStatus; label: string }[] = [
  { status: 'todo', label: 'To do' },
  { status: 'doing', label: 'Doing' },
  { status: 'done', label: 'Done' },
]

export const STATUS_LABEL: Record<CardStatus, string> = {
  todo: 'To do',
  doing: 'Doing',
  done: 'Done',
}

/** All board cards for the current repo (live-refreshed when the agent moves one).
 *  `error` surfaces a failed fetch so callers can distinguish it from an empty
 *  board (which would otherwise both render as no cards). */
export function useBoardCards(): { cards: BoardCard[]; error: string | null } {
  const repo = useRepoStore((s) => s.repo)
  const { data, error } = trpc.boardCards.useQuery(repo?.path ?? '', { enabled: repo !== null })
  return { cards: data ?? [], error: error?.message ?? null }
}

export interface NewCardInput {
  title: string
  body?: string
  status?: CardStatus
}

/** Optimistic-update rollback context: the pre-mutation cache snapshot for one repo. */
type MutationContext = { previous: BoardCard[] | undefined; repoPath: string }

type AddCardVars = { repoPath: string; title: string; body?: string; status?: CardStatus }
type UpdateCardVars = { repoPath: string; id: string; title?: string; body?: string }
type MoveCardVars = { repoPath: string; id: string; status: CardStatus }
type DeleteCardVars = { repoPath: string; id: string }
type ClearCardsVars = { repoPath: string; status: CardStatus }

/** The id an optimistically-added card carries until the server's real one arrives on
 *  the reconciling refetch. Never sent to the daemon, never written to the channel. */
function temporaryId(): string {
  return `optimistic-${randomId()}`
}

/**
 * Add/edit/move/delete board cards. Each mutation writes the cache optimistically and
 * reconciles on settle. The board channel has no poll (only the `board` app event
 * refreshes it), so the optimistic value stands until real data replaces it.
 */
export function useCardActions(): {
  add: (input: NewCardInput) => Promise<void>
  update: (id: string, fields: { title?: string; body?: string }) => Promise<void>
  move: (id: string, status: CardStatus) => Promise<void>
  remove: (id: string) => Promise<void>
  clear: (status: CardStatus) => Promise<void>
} {
  const repo = useRepoStore((s) => s.repo)
  const utils = trpc.useUtils()

  // No-op until the board has loaded — seeding a cache entry from a single write would
  // publish a list that is missing every card the query has not fetched yet.
  const patch = (repoPath: string, next: (cards: BoardCard[]) => BoardCard[]): void => {
    utils.boardCards.setData(repoPath, (cards) => (cards ? next(cards) : undefined))
  }
  const begin = async (
    repoPath: string,
    next: (cards: BoardCard[]) => BoardCard[],
  ): Promise<MutationContext> => {
    await utils.boardCards.cancel(repoPath)
    const previous = utils.boardCards.getData(repoPath)
    patch(repoPath, next)
    return { previous, repoPath }
  }
  const rollback = (context: MutationContext | undefined): void => {
    if (context) utils.boardCards.setData(context.repoPath, context.previous)
  }

  const add = trpc.addBoardCard.useMutation({
    onMutate: ({ repoPath, title, body, status }: AddCardVars): Promise<MutationContext> => {
      const now = Date.now()
      const card: BoardCard = {
        id: temporaryId(),
        title,
        status: status ?? 'todo',
        order: now,
        createdAt: now,
        ...(body !== undefined ? { body } : {}),
      }
      return begin(repoPath, (cards) => [...cards, card])
    },
    onError: (
      error: { message: string },
      _vars: unknown,
      context: MutationContext | undefined,
    ): void => {
      rollback(context)
      onMutationError('Add card')(error)
    },
    onSettled: async (
      _data: unknown,
      _error: unknown,
      { repoPath }: AddCardVars,
    ): Promise<void> => {
      await utils.boardCards.invalidate(repoPath)
    },
  })
  const update = trpc.updateBoardCard.useMutation({
    onMutate: ({ repoPath, id, title, body }: UpdateCardVars): Promise<MutationContext> =>
      begin(repoPath, (cards) =>
        cards.map((card) =>
          card.id === id
            ? {
                ...card,
                ...(title !== undefined ? { title } : {}),
                ...(body !== undefined ? { body } : {}),
              }
            : card,
        ),
      ),
    onError: (
      error: { message: string },
      _vars: unknown,
      context: MutationContext | undefined,
    ): void => {
      rollback(context)
      onMutationError('Update card')(error)
    },
    onSettled: async (
      _data: unknown,
      _error: unknown,
      { repoPath }: UpdateCardVars,
    ): Promise<void> => {
      await utils.boardCards.invalidate(repoPath)
    },
  })
  const move = trpc.moveBoardCard.useMutation({
    onMutate: ({ repoPath, id, status }: MoveCardVars): Promise<MutationContext> =>
      // Mirrors moveCard: the order bump re-sorts the card to the end of its new column.
      begin(repoPath, (cards) => {
        const moved = cards.find((card) => card.id === id)
        if (!moved) return cards
        const rest = cards.filter((card) => card.id !== id)
        return [...rest, { ...moved, status, order: Date.now() }]
      }),
    onError: (
      error: { message: string },
      _vars: unknown,
      context: MutationContext | undefined,
    ): void => {
      rollback(context)
      onMutationError('Move card')(error)
    },
    onSettled: async (
      _data: unknown,
      _error: unknown,
      { repoPath }: MoveCardVars,
    ): Promise<void> => {
      await utils.boardCards.invalidate(repoPath)
    },
  })
  const remove = trpc.deleteBoardCard.useMutation({
    onMutate: ({ repoPath, id }: DeleteCardVars): Promise<MutationContext> =>
      begin(repoPath, (cards) => cards.filter((card) => card.id !== id)),
    onError: (
      error: { message: string },
      _vars: unknown,
      context: MutationContext | undefined,
    ): void => {
      rollback(context)
      onMutationError('Delete card')(error)
    },
    onSettled: async (
      _data: unknown,
      _error: unknown,
      { repoPath }: DeleteCardVars,
    ): Promise<void> => {
      await utils.boardCards.invalidate(repoPath)
    },
  })
  const clear = trpc.clearBoardCards.useMutation({
    onMutate: ({ repoPath, status }: ClearCardsVars): Promise<MutationContext> =>
      begin(repoPath, (cards) => cards.filter((card) => card.status !== status)),
    onError: (
      error: { message: string },
      _vars: unknown,
      context: MutationContext | undefined,
    ): void => {
      rollback(context)
      onMutationError('Clear cards')(error)
    },
    onSettled: async (
      _data: unknown,
      _error: unknown,
      { repoPath }: ClearCardsVars,
    ): Promise<void> => {
      await utils.boardCards.invalidate(repoPath)
    },
  })

  return {
    add: async (input: NewCardInput): Promise<void> => {
      if (!repo) return
      await add.mutateAsync({ repoPath: repo.path, ...input })
    },
    update: async (id: string, fields: { title?: string; body?: string }): Promise<void> => {
      if (!repo) return
      await update.mutateAsync({ repoPath: repo.path, id, ...fields })
    },
    move: async (id: string, status: CardStatus): Promise<void> => {
      if (!repo) return
      await move.mutateAsync({ repoPath: repo.path, id, status })
    },
    remove: async (id: string): Promise<void> => {
      if (!repo) return
      await remove.mutateAsync({ repoPath: repo.path, id })
    },
    clear: async (status: CardStatus): Promise<void> => {
      if (!repo) return
      await clear.mutateAsync({ repoPath: repo.path, status })
    },
  }
}
