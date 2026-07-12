import { Button } from '@renderer/components/ui/button'
import { BOARD_COLUMNS, useBoardCards } from '@renderer/hooks/use-board'
import { draftFromCard, useCardDraftStore } from '@renderer/stores/card-draft'
import { Plus } from 'lucide-react'
import { CardItem } from './card-item'
import { ClearColumnButton } from './clear-column-button'

/** The wide kanban: the three columns side by side, in a viewer tab. */
export function BoardView(): React.JSX.Element {
  const { cards, error } = useBoardCards()
  const openDraft = useCardDraftStore((s) => s.open)

  if (error) {
    return (
      <div className="flex h-full items-center justify-center p-4">
        <p className="max-w-md text-center text-sm text-destructive">
          Couldn't load the board. {error}
        </p>
      </div>
    )
  }

  return (
    <div className="flex h-full gap-3 overflow-x-auto p-4">
      {BOARD_COLUMNS.map((column) => {
        const inColumn = cards.filter((card) => card.status === column.status)
        return (
          <div key={column.status} className="flex min-h-0 w-72 shrink-0 flex-col gap-2">
            <div className="flex items-center justify-between px-1">
              <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                {column.label} · {inColumn.length}
              </span>
              <div className="flex items-center gap-0.5">
                {column.status === 'done' && (
                  <ClearColumnButton status={column.status} count={inColumn.length} />
                )}
                <Button
                  variant="ghost"
                  size="icon-sm"
                  aria-label={`Add card to ${column.label}`}
                  onClick={() => openDraft({ title: '', body: '', status: column.status })}
                >
                  <Plus />
                </Button>
              </div>
            </div>
            <div className="flex min-h-0 flex-1 flex-col gap-2 overflow-y-auto">
              {inColumn.map((card) => (
                <CardItem key={card.id} card={card} onEdit={(c) => openDraft(draftFromCard(c))} />
              ))}
              {inColumn.length === 0 && (
                <p className="px-1 text-xs-minus text-muted-foreground/60">No cards</p>
              )}
            </div>
          </div>
        )
      })}
    </div>
  )
}
