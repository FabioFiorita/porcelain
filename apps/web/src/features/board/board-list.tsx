import type { BoardCard } from '@porcelain/contracts/board'
import { SidebarHeaderActions } from '@renderer/components/shell/sidebar-header-actions'
import { Button } from '@renderer/components/ui/button'
import { targetedTab } from '@renderer/stores/hub-tabs'
import { useProjectSelectionStore } from '@renderer/stores/project-selection'
import { useTabsStore } from '@renderer/stores/tabs'
import { Columns3, Plus } from 'lucide-react'
import { BOARD_COLUMNS } from './board-columns'
import { useBoardCards } from './board-queries'
import { draftFromCard, useCardDraftStore } from './card-draft-store'
import { CardItem } from './card-item'
import { ClearColumnButton } from './clear-column-button'

/**
 * The Board sidebar tab body: the three columns stacked vertically (narrow panel),
 * each with an add button and its cards. "Open board" opens the wide side-by-side
 * board in the viewer. Mirrors the Review tab (list here, expanded view in the viewer).
 */
export function BoardList(): React.JSX.Element {
  const { cards, error } = useBoardCards()
  const project = useProjectSelectionStore((s) => s.project)
  const openTab = useTabsStore((s) => s.openTab)
  const openDraft = useCardDraftStore((s) => s.open)

  const handleOpenBoard = (): void => {
    if (!project) return
    openTab(targetedTab('board', project.path, { title: 'Board' }))
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-end px-2">
        <SidebarHeaderActions>
          <Button variant="ghost" size="icon-sm" onClick={handleOpenBoard} aria-label="Open board">
            <Columns3 />
          </Button>
        </SidebarHeaderActions>
      </div>
      {error ? (
        <p className="px-3 py-2 text-xs break-words text-destructive">
          Couldn't load the board. {error}
        </p>
      ) : (
        BOARD_COLUMNS.map((column) => {
          const inColumn = cards.filter((card) => card.status === column.status)
          return (
            <div key={column.status} className="flex flex-col gap-1.5">
              <div className="flex items-center justify-between px-2">
                <span className="text-2xs font-bold uppercase tracking-[0.08em] text-muted-foreground">
                  {column.label} · {inColumn.length}
                </span>
                <div className="flex items-center gap-0.5">
                  {column.status === 'done' && (
                    <ClearColumnButton
                      status={column.status}
                      count={inColumn.length}
                      className="size-5"
                    />
                  )}
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    className="size-5"
                    aria-label={`Add card to ${column.label}`}
                    onClick={() => openDraft({ title: '', body: '', status: column.status })}
                  >
                    <Plus />
                  </Button>
                </div>
              </div>
              <div className="flex flex-col gap-1.5 px-2">
                {inColumn.map((card) => (
                  <CardItem
                    key={card.id}
                    card={card}
                    compact
                    onEdit={(c: BoardCard): void => openDraft(draftFromCard(c))}
                  />
                ))}
              </div>
            </div>
          )
        })
      )}
    </div>
  )
}
