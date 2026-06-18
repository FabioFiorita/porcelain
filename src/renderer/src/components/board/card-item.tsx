import type { BoardCard, CardStatus } from '@main/board-store'
import { Button } from '@renderer/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@renderer/components/ui/dropdown-menu'
import { BOARD_COLUMNS, useCardActions } from '@renderer/hooks/use-board'
import { CheckCircle2, Circle, CircleDot, MoreHorizontal, PenLine, Trash2 } from 'lucide-react'

/** Icon per column, so a "Move to …" row reads at a glance. */
const COLUMN_ICON: Record<CardStatus, React.ComponentType> = {
  todo: Circle,
  doing: CircleDot,
  done: CheckCircle2,
}

/**
 * A board card chip with a "⋯" menu: edit, move to another column (the MCP moves
 * cards too — this is the human's equivalent), or delete. Shared by the sidebar
 * board list and the wide viewer board.
 */
export function CardItem({
  card,
  onEdit,
}: {
  card: BoardCard
  onEdit: (card: BoardCard) => void
}): React.JSX.Element {
  const { move, remove } = useCardActions()
  return (
    <div className="group/card glaze-tile flex items-start gap-1 p-2 [--tile-fill:var(--surface-2)]">
      <div className="min-w-0 flex-1">
        <p className="break-words text-xs font-medium">{card.title}</p>
        {card.body && (
          <p className="mt-0.5 line-clamp-3 whitespace-pre-wrap text-[11px] text-muted-foreground">
            {card.body}
          </p>
        )}
      </div>
      <DropdownMenu>
        <DropdownMenuTrigger
          render={
            <Button
              variant="ghost"
              size="icon-sm"
              className="size-5 shrink-0 opacity-0 group-hover/card:opacity-100"
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
