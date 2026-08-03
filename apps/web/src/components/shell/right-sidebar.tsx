import { BoardQuickAccess } from '@renderer/components/board/board-quick-access'
import { ActionsGroup } from '@renderer/components/terminal/actions-group'
import { Sidebar, SidebarContent, SidebarHeader, useSidebar } from '@renderer/components/ui/sidebar'
import { type SidebarTab, usePreferencesStore } from '@renderer/stores/preferences'
import { TestIds } from '@shared/test-ids'
import { CommentsGroup } from './comments-group'
import { CommitGroup } from './commit-group'
import { FileTimelineGroup } from './file-timeline-group'
import { FilesQuickAccess } from './files-quick-access'
import { QuickCommandsGroup } from './quick-commands-group'
import { ReviewGroup } from './review-group'
import { SearchQuickAccess } from './search-quick-access'
import { RightSidebarResizeHandle } from './sidebar-resize-handle'

// The companion panel retitles itself to what you're doing (matching the left
// panel's contextual header) instead of a generic "Quick access" — the redesign
// dropped the "Quick Access" / "Quick Commands" labels. Left vs right must never
// share the same title for one tab (Board list vs Focus detail).
const COMPANION_TITLES: Record<SidebarTab, string> = {
  files: 'Pinned & notes',
  changes: 'Commit',
  history: 'Timeline',
  // Review companion — not a git clone (P7 / U5).
  feature: 'Now reading',
  board: 'Focus',
  terminal: 'Actions',
  search: 'Recent searches',
}

// Sections follow the left sidebar's active tab. Board Focus is the selected
// card detail (default first Doing); Files keeps pins/notes. Feature stays Review-native.
export function RightSidebar(): React.JSX.Element {
  const sidebarTab = usePreferencesStore((s) => s.sidebarTab)
  const { isMobile } = useSidebar()

  return (
    <Sidebar
      side="right"
      variant="floating"
      collapsible="offcanvas"
      data-testid={TestIds.rightSidebar}
      // Match the viewer and left card below the titlebar + safe areas. Keeping
      // this responsive prevents the phone Sheet from inheriting a desktop offset.
      className="md:top-[calc(3rem+env(safe-area-inset-top))] md:h-[calc(100dvh-3rem-env(safe-area-inset-top)-env(safe-area-inset-bottom))] md:pt-0"
    >
      {!isMobile && <RightSidebarResizeHandle />}
      <SidebarHeader className="app-drag h-12 flex-row items-center border-b py-0 pr-1 pl-3">
        <span className="truncate text-xs font-semibold text-foreground">
          {COMPANION_TITLES[sidebarTab]}
        </span>
      </SidebarHeader>
      <SidebarContent
        className={
          sidebarTab === 'files' || sidebarTab === 'board' ? 'gap-0 overflow-hidden' : undefined
        }
      >
        {sidebarTab === 'files' && <FilesQuickAccess />}
        {sidebarTab === 'board' && <BoardQuickAccess />}
        {(sidebarTab === 'changes' || sidebarTab === 'history') && <QuickCommandsGroup />}
        {sidebarTab === 'history' && <FileTimelineGroup />}
        {sidebarTab === 'feature' && <ReviewGroup />}
        {sidebarTab === 'changes' && <CommitGroup />}
        {(sidebarTab === 'changes' || sidebarTab === 'feature') && <CommentsGroup />}
        {sidebarTab === 'terminal' && <ActionsGroup />}
        {sidebarTab === 'search' && <SearchQuickAccess />}
      </SidebarContent>
    </Sidebar>
  )
}
