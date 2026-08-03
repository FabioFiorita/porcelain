import type { BoardCard, CardStatus } from '@backend/stores/board-store'
import { Button } from '@renderer/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@renderer/components/ui/dropdown-menu'
import { BOARD_COLUMNS, useBoardCards, useCardActions } from '@renderer/hooks/use-board'
import { cn } from '@renderer/lib/utils'
import { resolveBoardFocus, useBoardSelectionStore } from '@renderer/stores/board-selection'
import { useRepoStore } from '@renderer/stores/repo'
import { TestIds } from '@shared/test-ids'
import { CheckCircle2, Circle, CircleDot, MoreHorizontal, PenLine, Trash2 } from 'lucide-react'

/** Icon per column, so a "Move to …" row reads at a glance. */
const COLUMN_ICON: Record<CardStatus, React.ComponentType> = {
  todo: Circle,
  doing: CircleDot,
  done: CheckCircle2,
}

/**
 * A board card chip with a "⋯" menu: edit, move column (the CLI does this for
 * agents too), or delete. Shared by the sidebar list and the wide viewer board;
 * `compact` clamps the body to one line so the sidebar reads as an index, not a
 * second board copy.
 *
 * Primary click selects the card for the Focus companion; edit stays on the menu.
 */
export function CardItem({
  card,
  onEdit,
  compact = false,
}: {
  card: BoardCard
  onEdit: (card: BoardCard) => void
  compact?: boolean
}): React.JSX.Element {
  const { move, remove } = useCardActions()
  const { cards } = useBoardCards()
  const repoPath = useRepoStore((s) => s.repo?.path)
  const focusKey = useBoardSelectionStore((s) => s.focus)
  const select = useBoardSelectionStore((s) => s.select)
  const selected = resolveBoardFocus(cards, repoPath, focusKey)?.id === card.id

  return (
    <div
      data-testid={TestIds.boardCard(card.title)}
      data-selected={selected ? 'true' : undefined}
      className={cn(
        'group/card flex items-start gap-1 rounded-xl border bg-card p-2 transition-colors',
        selected && 'bg-accent',
        !selected && 'hover:bg-accent/50',
        !compact && 'max-h-48',
      )}
    >
      <button
        type="button"
        onClick={() => {
          if (repoPath) select(repoPath, card.id)
        }}
        aria-pressed={selected}
        className="min-h-0 min-w-0 flex-1 rounded-md text-left outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
      >
        {/* Title capped so a multi-line title never eats the column; body scrolls (or,
            in the compact outline, clamps to a single preview line). */}
        <p
          className={cn(
            'break-words text-xs font-medium',
            compact ? 'line-clamp-2' : 'max-h-10 overflow-y-auto',
          )}
        >
          {card.title}
        </p>
        {card.body && (
          <p
            className={cn(
              'mt-0.5 text-xs-minus text-muted-foreground',
              compact ? 'line-clamp-1' : 'max-h-28 overflow-y-auto whitespace-pre-wrap',
            )}
          >
            {card.body}
          </p>
        )}
      </button>
      <DropdownMenu>
        <DropdownMenuTrigger
          render={
            <Button
              variant="ghost"
              size="icon-sm"
              className="size-5 shrink-0 opacity-0 group-hover/card:opacity-100 [@media(hover:none)]:opacity-100"
              aria-label="Card actions"
            >
              <MoreHorizontal />
            </Button>
          }
        />
        <DropdownMenuContent align="end">
          <DropdownMenuItem onClick={() => onEdit(card)}>
            <PenLine />
            Edit
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          {BOARD_COLUMNS.filter((column) => column.status !== card.status).map((column) => {
            const Icon = COLUMN_ICON[column.status]
            return (
              <DropdownMenuItem key={column.status} onClick={() => move(card.id, column.status)}>
                <Icon />
                Move to {column.label}
              </DropdownMenuItem>
            )
          })}
          <DropdownMenuSeparator />
          <DropdownMenuItem variant="destructive" onClick={() => remove(card.id)}>
            <Trash2 />
            Delete
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  )
}
