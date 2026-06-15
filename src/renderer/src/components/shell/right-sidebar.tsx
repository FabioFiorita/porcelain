import { Sidebar, SidebarContent, SidebarHeader } from '@renderer/components/ui/sidebar'
import { usePreferencesStore } from '@renderer/stores/preferences'
import { CommitGroup } from './commit-group'
import { FilesQuickAccess } from './files-quick-access'
import { QuickCommandsGroup } from './quick-commands-group'
import { RightSidebarResizeHandle } from './sidebar-resize-handle'

// Sections follow the left sidebar's active tab: pins belong to browsing
// files, git actions belong to reviewing changes/history/feature. The Feature
// tab mirrors Changes (quick commands + commit composer) — you review a feature
// to commit it.
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
      <SidebarContent className={sidebarTab === 'files' ? 'gap-0 overflow-hidden' : undefined}>
        {sidebarTab === 'files' && <FilesQuickAccess />}
        {sidebarTab !== 'files' && <QuickCommandsGroup />}
        {(sidebarTab === 'changes' || sidebarTab === 'feature') && <CommitGroup />}
      </SidebarContent>
    </Sidebar>
  )
}
