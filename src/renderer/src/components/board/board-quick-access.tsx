import type { BoardCard, CardStatus } from '@backend/board-store'
import { Button } from '@renderer/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@renderer/components/ui/dropdown-menu'
import {
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
} from '@renderer/components/ui/sidebar'
import {
  BOARD_COLUMNS,
  STATUS_LABEL,
  useBoardCards,
  useCardActions,
} from '@renderer/hooks/use-board'
import { compactButtonClass } from '@renderer/lib/controls'
import { cn } from '@renderer/lib/utils'
import { resolveBoardFocus, useBoardSelectionStore } from '@renderer/stores/board-selection'
import { draftFromCard, useCardDraftStore } from '@renderer/stores/card-draft'
import { useRepoStore } from '@renderer/stores/repo'
import { TestIds } from '@shared/test-ids'
import { CheckCircle2, ChevronDown, Circle, CircleDot, PenLine, Trash2 } from 'lucide-react'

const COLUMN_ICON: Record<CardStatus, React.ComponentType> = {
  todo: Circle,
  doing: CircleDot,
  done: CheckCircle2,
}

/**
 * Board Focus companion: the selected card's full detail in the right rail.
 * Default = first Doing (then Todo, then Done). Click any card in the list or
 * wide kanban to focus it here. Edit / move / delete live on this surface so
 * the column chips stay an index, not a second editor.
 */
export function BoardQuickAccess(): React.JSX.Element {
  const { cards, error } = useBoardCards()
  const repoPath = useRepoStore((s) => s.repo?.path)
  const focusKey = useBoardSelectionStore((s) => s.focus)
  const focus = resolveBoardFocus(cards, repoPath, focusKey)
  const { move, remove } = useCardActions()
  const openDraft = useCardDraftStore((s) => s.open)

  if (error) {
    return (
      <p className="px-3 py-2 text-xs break-words text-destructive">
        Couldn't load the board. {error}
      </p>
    )
  }

  if (!focus) {
    return (
      <div
        data-testid={TestIds.boardFocus}
        className="flex flex-1 flex-col items-center justify-center gap-1 px-4 py-8 text-center"
      >
        <p className="text-xs text-muted-foreground">No cards yet</p>
        <p className="text-2xs text-muted-foreground/80">
          Add one from the Board list — it will open here.
        </p>
      </div>
    )
  }

  return (
    <CardDetail
      card={focus}
      onEdit={() => openDraft(draftFromCard(focus))}
      move={move}
      remove={remove}
    />
  )
}

function CardDetail({
  card,
  onEdit,
  move,
  remove,
}: {
  card: BoardCard
  onEdit: () => void
  move: (id: string, status: CardStatus) => Promise<void>
  remove: (id: string) => Promise<void>
}): React.JSX.Element {
  const StatusIcon = COLUMN_ICON[card.status]

  return (
    <div
      data-testid={TestIds.boardFocus}
      data-card-id={card.id}
      className="flex h-full min-h-0 flex-col"
    >
      <SidebarGroup className="min-h-0 flex-1 p-0">
        <SidebarGroupLabel className="px-3 pt-2">
          <span className="flex items-center gap-1.5 text-2xs font-bold uppercase tracking-[0.08em] text-muted-foreground">
            <StatusIcon />
            {STATUS_LABEL[card.status]}
          </span>
        </SidebarGroupLabel>
        <SidebarGroupContent className="flex min-h-0 flex-1 flex-col gap-3 px-3 pb-3">
          <h2 className="text-sm font-medium break-words text-foreground">{card.title}</h2>
          {card.body ? (
            <div className="min-h-0 flex-1 overflow-y-auto">
              <p className="whitespace-pre-wrap text-xs text-muted-foreground">{card.body}</p>
            </div>
          ) : (
            <p className="text-2xs text-muted-foreground/70">No details</p>
          )}
          <div className="flex shrink-0 flex-wrap items-center gap-1.5 border-t pt-2">
            <Button
              variant="outline"
              size="sm"
              className={compactButtonClass}
              onClick={onEdit}
              aria-label="Edit card"
            >
              <PenLine /> Edit
            </Button>
            <DropdownMenu>
              <DropdownMenuTrigger
                render={
                  <Button variant="outline" size="sm" className={compactButtonClass}>
                    Move <ChevronDown />
                  </Button>
                }
              />
              <DropdownMenuContent align="start">
                {BOARD_COLUMNS.filter((column) => column.status !== card.status).map((column) => {
                  const Icon = COLUMN_ICON[column.status]
                  return (
                    <DropdownMenuItem
                      key={column.status}
                      onClick={() => move(card.id, column.status)}
                    >
                      <Icon />
                      {column.label}
                    </DropdownMenuItem>
                  )
                })}
              </DropdownMenuContent>
            </DropdownMenu>
            <Button
              variant="ghost"
              size="sm"
              className={cn(
                compactButtonClass,
                'ml-auto text-muted-foreground hover:text-destructive',
              )}
              onClick={() => remove(card.id)}
              aria-label="Delete card"
            >
              <Trash2 /> Delete
            </Button>
          </div>
        </SidebarGroupContent>
      </SidebarGroup>
    </div>
  )
}
