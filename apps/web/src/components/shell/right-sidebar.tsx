import { Sidebar, SidebarContent, SidebarHeader, useSidebar } from '@renderer/components/ui/sidebar'
import { ActionsGroup } from '@renderer/features/actions'
import { BoardQuickAccess } from '@renderer/features/board'
import { SearchQuickAccess } from '@renderer/features/search'
import { usePreferencesStore } from '@renderer/stores/preferences'
import { TestIds } from '@shared/test-ids'
import { CommentsGroup } from './comments-group'
import { CommitGroup } from './commit-group'
import { FileTimelineGroup } from './file-timeline-group'
import { FilesQuickAccess } from './files-quick-access'
import { QuickCommandsGroup } from './quick-commands-group'
import { ReviewGroup } from './review-group'
import { RightSidebarResizeHandle } from './sidebar-resize-handle'

// Sections follow the left sidebar's active tab. Board Focus is the selected
// card detail (default first Doing); Files keeps pins/notes. The rail stays Review-native.
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
      // pt-px, NOT pt-0: this card's outline is a `ring-1`, painted OUTSIDE the box,
      // while the viewer's is a border painted inside it. Flush at pt-0 the ring
      // landed a pixel ABOVE the viewer's top edge — the cards shared a border box
      // but not a visible frame. One pixel of padding puts the paint on one row.
      className="md:top-[calc(3rem+env(safe-area-inset-top))] md:h-[calc(100dvh-3rem-env(safe-area-inset-top)-env(safe-area-inset-bottom))] md:pt-px"
    >
      {!isMobile && <RightSidebarResizeHandle />}
      <SidebarHeader className="app-drag h-12 flex-row items-center border-b py-0 pr-1 pl-3">
        {/* The right panel is the Companion on every tab — one name you learn once.
            Sections inside it do the orienting; the header never moves. Mobile names
            it the same way. */}
        <span className="truncate text-xs font-semibold text-foreground">Companion</span>
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
        {sidebarTab === 'review' && <ReviewGroup />}
        {sidebarTab === 'changes' && <CommitGroup />}
        {(sidebarTab === 'changes' || sidebarTab === 'review') && <CommentsGroup />}
        {sidebarTab === 'terminal' && <ActionsGroup />}
        {sidebarTab === 'search' && <SearchQuickAccess />}
      </SidebarContent>
    </Sidebar>
  )
}
