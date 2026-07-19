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
    <div className="h-full overflow-x-auto p-4">
      {/* Center the columns within a sensible max so a wide canvas doesn't leave a dead
          right half; each column shares the width equally (flex-1) down to a min. */}
      <div className="mx-auto flex h-full max-w-[80rem] gap-3">
        {BOARD_COLUMNS.map((column) => {
          const inColumn = cards.filter((card) => card.status === column.status)
          return (
            <div key={column.status} className="flex min-h-0 min-w-64 flex-1 flex-col gap-2">
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
                  <div className="flex flex-1 items-center justify-center p-4">
                    <p className="text-xs text-muted-foreground/50">No cards yet</p>
                  </div>
                )}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
