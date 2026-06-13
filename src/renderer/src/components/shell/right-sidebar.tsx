import { Sidebar, SidebarContent, SidebarHeader } from '@renderer/components/ui/sidebar'
import { usePreferencesStore } from '@renderer/stores/preferences'
import { CommitGroup } from './commit-group'
import { PinnedGroup } from './pinned-group'
import { QuickCommandsGroup } from './quick-commands-group'
import { RightSidebarResizeHandle } from './sidebar-resize-handle'

// Sections follow the left sidebar's active tab: pins belong to browsing
// files, git actions belong to reviewing changes/history.
export function RightSidebar(): React.JSX.Element {
  const sidebarTab = usePreferencesStore((s) => s.sidebarTab)

  return (
    <Sidebar side="right" variant="floating" collapsible="offcanvas">
      <RightSidebarResizeHandle />
      <SidebarHeader className="app-drag h-12 flex-row items-center border-b py-0">
        <span className="truncate text-xs font-medium uppercase tracking-wider text-muted-foreground">
          Quick access
        </span>
      </SidebarHeader>
      <SidebarContent>
        {sidebarTab === 'files' && <PinnedGroup />}
        {sidebarTab !== 'files' && <QuickCommandsGroup />}
        {sidebarTab === 'changes' && <CommitGroup />}
      </SidebarContent>
    </Sidebar>
  )
}
