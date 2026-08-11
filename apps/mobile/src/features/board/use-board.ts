import { useState } from 'react'

import { useShellStore } from '@/features/shell/shell-store'
import { useIsTablet } from '@/features/shell/use-app-window'
import {
  addBoardCardMutation,
  type BoardCard,
  boardCardsQuery,
  type CardStatus,
  clearBoardCardsMutation,
  deleteBoardCardMutation,
  moveBoardCardMutation,
  updateBoardCardMutation,
} from '@/lib/daemon/procedures/review'
import { useDaemonMutation, useDaemonQuery } from '@/lib/daemon/queries'
import { useActiveRepo } from '@/lib/daemon/repo'

import { useBoardStore } from './board-store'

/** The three columns, in order, with their display labels — the web board's vocabulary. */
export const BOARD_COLUMNS: readonly { status: CardStatus; label: string }[] = [
  { label: 'To do', status: 'todo' },
  { label: 'Doing', status: 'doing' },
  { label: 'Done', status: 'done' },
]

export const STATUS_LABEL: Record<CardStatus, string> = {
  doing: 'Doing',
  done: 'Done',
  todo: 'To do',
}

export type BoardCards = {
  cards: BoardCard[]
  error: Error | null
  /** True only until the first read lands — a board that has loaded empty is not loading. */
  isLoading: boolean
}

/**
 * Every card on the open repo's board.
 *
 * No poll, by design: the daemon pushes a `board.changed` session signal whenever a card is
 * written — whether by this client, the desktop, or the agent through the CLI — and the
 * session binding turns that into an invalidation. A timer here would only add reads the
 * socket already covers.
 */
export function useBoardCards(active: boolean): BoardCards {
  const repo = useActiveRepo()
  const { data, error, isLoading } = useDaemonQuery(boardCardsQuery, repo?.path ?? '', {
    enabled: active && repo !== null,
  })
  return { cards: data ?? [], error, isLoading: isLoading && data === undefined }
}

/** One column's cards, in the order the daemon assigned them. */
export function cardsInColumn(cards: readonly BoardCard[], status: CardStatus): BoardCard[] {
  return cards
    .filter((card) => card.status === status)
    .sort((left, right) => left.order - right.order)
}

/**
 * Board writes are invalidate-only: the mutation lands, `boardCards` goes stale, and the
 * refetch publishes what the daemon actually stored. No optimistic cache writes on this client.
 */
const BOARD_INVALIDATIONS = ['boardCards'] as const

export type CardActions = {
  add: (input: { title: string; body?: string; status: CardStatus }) => Promise<void>
  update: (id: string, fields: { title: string; body: string }) => Promise<void>
  move: (id: string, status: CardStatus) => Promise<void>
  remove: (id: string) => Promise<void>
  clear: (status: CardStatus) => Promise<void>
}

/** Add, edit, move, delete, and bulk-clear cards on the open repo's board. */
export function useCardActions(): CardActions {
  const repo = useActiveRepo()
  const add = useDaemonMutation(addBoardCardMutation, { invalidates: BOARD_INVALIDATIONS })
  const update = useDaemonMutation(updateBoardCardMutation, { invalidates: BOARD_INVALIDATIONS })
  const move = useDaemonMutation(moveBoardCardMutation, { invalidates: BOARD_INVALIDATIONS })
  const remove = useDaemonMutation(deleteBoardCardMutation, { invalidates: BOARD_INVALIDATIONS })
  const clear = useDaemonMutation(clearBoardCardsMutation, { invalidates: BOARD_INVALIDATIONS })

  return {
    add: async (input): Promise<void> => {
      if (repo === null) return
      await add.mutateAsync({
        repoPath: repo.path,
        status: input.status,
        title: input.title,
        ...(input.body === undefined ? {} : { body: input.body }),
      })
    },
    clear: async (status): Promise<void> => {
      if (repo === null) return
      await clear.mutateAsync({ repoPath: repo.path, status })
    },
    move: async (id, status): Promise<void> => {
      if (repo === null) return
      await move.mutateAsync({ id, repoPath: repo.path, status })
    },
    remove: async (id): Promise<void> => {
      if (repo === null) return
      await remove.mutateAsync({ id, repoPath: repo.path })
    },
    update: async (id, fields): Promise<void> => {
      if (repo === null) return
      await update.mutateAsync({ body: fields.body, id, repoPath: repo.path, title: fields.title })
    },
  }
}

/**
 * Every board write is a daemon round trip that can fail — a repo that moved, a card the agent
 * deleted first. Report it on the panel that triggered it rather than letting a tap look like
 * it worked.
 */
export function useBoardFailure(): {
  failure: string | null
  guard: (label: string, run: () => Promise<void>) => void
} {
  const [failure, setFailure] = useState<string | null>(null)

  return {
    failure,
    guard: (label, run) => {
      setFailure(null)
      run().catch((cause: unknown) => {
        setFailure(`${label}: ${cause instanceof Error ? cause.message : String(cause)}`)
      })
    },
  }
}

/**
 * Focus a card from any board panel.
 *
 * On tablet the Focus rail is already on screen beside the board, so a tap is just a selection.
 * On phone the companion is a sheet, so the tap that focuses a card also opens the sheet that
 * shows it — otherwise the selection would have no visible effect at all.
 */
export function useFocusCard(): (card: BoardCard) => void {
  const repo = useActiveRepo()
  const select = useBoardStore((state) => state.select)
  const isTablet = useIsTablet()
  const openSheet = useShellStore((state) => state.openSheet)
  const setActiveSurface = useShellStore((state) => state.setActiveSurface)

  return (card: BoardCard): void => {
    if (repo === null) return
    select(repo.path, card.id)
    if (isTablet) return
    setActiveSurface('board')
    openSheet('companion')
  }
}

/** The focused card id for the open repo, or `null` when the Focus rail is on its default. */
export function useSelectedCardId(): string | null {
  const repo = useActiveRepo()
  const focus = useBoardStore((state) => state.focus)
  if (focus === null || repo === null) return null
  return focus.repoPath === repo.path ? focus.cardId : null
}
