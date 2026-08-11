import type { BoardCard, BoardStatus } from '@porcelain/contracts/board'

/**
 * Mobile Board column order and human labels. Presentation-only; cards stay Query data.
 * Status values come from `@porcelain/contracts/board`.
 */

export type { BoardStatus }

/** The three columns, in order, with their display labels. */
export const BOARD_COLUMNS: readonly { status: BoardStatus; label: string }[] = [
  { label: 'To do', status: 'todo' },
  { label: 'Doing', status: 'doing' },
  { label: 'Done', status: 'done' },
]

/** Human label for a Board column status. */
export function boardStatusLabel(status: BoardStatus): string {
  switch (status) {
    case 'todo':
      return 'To do'
    case 'doing':
      return 'Doing'
    case 'done':
      return 'Done'
    default: {
      const _exhaustive: never = status
      return _exhaustive
    }
  }
}

/** One column's cards, in the order the daemon assigned them. */
export function cardsInColumn(cards: readonly BoardCard[], status: BoardStatus): BoardCard[] {
  return cards
    .filter((card) => card.status === status)
    .sort((left, right) => left.order - right.order)
}
