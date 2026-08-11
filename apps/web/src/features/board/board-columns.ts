import type { BoardStatus } from '@porcelain/contracts/board'

/**
 * Web Board column order and human labels. Presentation-only; cards stay Query data.
 * Status values come from `@porcelain/contracts/board` (never `@backend`).
 */

export type { BoardStatus }

/** The three columns, in order, with their display labels. */
export const BOARD_COLUMNS: { status: BoardStatus; label: string }[] = [
  { status: 'todo', label: 'To do' },
  { status: 'doing', label: 'Doing' },
  { status: 'done', label: 'Done' },
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
