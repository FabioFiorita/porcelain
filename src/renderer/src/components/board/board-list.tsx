import { SidebarHeaderActions } from '@renderer/components/shell/sidebar-header-actions'
import { Button } from '@renderer/components/ui/button'
import { BOARD_COLUMNS, useBoardCards } from '@renderer/hooks/use-board'
import { draftFromCard, useCardDraftStore } from '@renderer/stores/card-draft'
import { useRepoStore } from '@renderer/stores/repo'
import { tabId, useTabsStore } from '@renderer/stores/tabs'
import { Columns3, Plus } from 'lucide-react'
import { CardItem } from './card-item'

/**
 * The Board sidebar tab body: the three columns stacked vertically (narrow panel),
 * each with an add button and its cards. "Open board" opens the wide side-by-side
 * board in the viewer. Mirrors the Feature tab (list here, expanded view in the viewer).
 */
export function BoardList(): React.JSX.Element {
  const cards = useBoardCards()
  const repo = useRepoStore((s) => s.repo)
  const openTab = useTabsStore((s) => s.openTab)
  const openDraft = useCardDraftStore((s) => s.open)

  const openBoard = (): void => {
    if (!repo) return
    openTab({ id: tabId('board', repo.path), kind: 'board', title: 'Board', path: repo.path })
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-end px-2">
        <SidebarHeaderActions>
          <Button variant="ghost" size="icon-sm" onClick={openBoard} aria-label="Open board">
            <Columns3 />
          </Button>
        </SidebarHeaderActions>
      </div>
      {BOARD_COLUMNS.map((column) => {
        const inColumn = cards.filter((card) => card.status === column.status)
        return (
          <div key={column.status} className="flex flex-col gap-1.5">
            <div className="flex items-center justify-between px-2">
              <span className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
                {column.label} · {inColumn.length}
              </span>
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
            <div className="flex flex-col gap-1.5 px-2">
              {inColumn.map((card) => (
                <CardItem key={card.id} card={card} onEdit={(c) => openDraft(draftFromCard(c))} />
              ))}
            </div>
          </div>
        )
      })}
    </div>
  )
}
