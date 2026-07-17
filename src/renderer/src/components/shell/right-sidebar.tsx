import { AgentsQuickAccess } from '@renderer/components/agent/agents-quick-access'
import { ActionsGroup } from '@renderer/components/terminal/actions-group'
import { Sidebar, SidebarContent, SidebarHeader, useSidebar } from '@renderer/components/ui/sidebar'
import { type SidebarTab, usePreferencesStore } from '@renderer/stores/preferences'
import { CommentsGroup } from './comments-group'
import { CommitGroup } from './commit-group'
import { FileTimelineGroup } from './file-timeline-group'
import { FilesQuickAccess } from './files-quick-access'
import { QuickCommandsGroup } from './quick-commands-group'
import { SearchQuickAccess } from './search-quick-access'
import { RightSidebarResizeHandle } from './sidebar-resize-handle'

// The companion panel retitles itself to what you're doing (matching the left
// panel's contextual header) instead of a generic "Quick access" — the redesign
// dropped the "Quick Access" / "Quick Commands" labels.
const COMPANION_TITLES: Record<SidebarTab, string> = {
  files: 'Workspace',
  changes: 'Commit',
  history: 'Review',
  feature: 'Review',
  board: 'Workspace',
  chat: 'Workspace',
  terminal: 'Actions',
  search: 'Recent searches',
  // Distinct from the left sidebar's "Agent" tab (the thread roster). This panel is
  // the live session companion — plan, activity, files touched, usage/limits.
  agent: 'Session',
}

// Sections follow the left sidebar's active tab: pins belong to browsing
// files, git actions belong to reviewing changes/history/feature, saved actions
// belong to the terminal. The Feature tab mirrors Changes (quick commands + commit
// composer) — you review a feature to commit it.
export function RightSidebar(): React.JSX.Element {
  const sidebarTab = usePreferencesStore((s) => s.sidebarTab)
  const { isMobile } = useSidebar()

  return (
    <Sidebar
      side="right"
      variant="floating"
      collapsible="offcanvas"
      // Match the left card: sit below the h-12 titlebar (shadcn pins the floating
      // container to the full viewport otherwise), flush at the titlebar bottom.
      style={{ top: '3rem', height: 'calc(100svh - 3rem)', paddingTop: 0 }}
    >
      {!isMobile && <RightSidebarResizeHandle />}
      <SidebarHeader className="app-drag h-12 flex-row items-center border-b py-0 pr-1 pl-3">
        <span className="truncate text-xs font-semibold text-foreground">
          {COMPANION_TITLES[sidebarTab]}
        </span>
      </SidebarHeader>
      <SidebarContent className={sidebarTab === 'files' ? 'gap-0 overflow-hidden' : undefined}>
        {sidebarTab === 'files' && <FilesQuickAccess />}
        {(sidebarTab === 'changes' || sidebarTab === 'history' || sidebarTab === 'feature') && (
          <QuickCommandsGroup />
        )}
        {sidebarTab === 'history' && <FileTimelineGroup />}
        {(sidebarTab === 'changes' || sidebarTab === 'feature') && <CommitGroup />}
        {(sidebarTab === 'changes' || sidebarTab === 'feature') && <CommentsGroup />}
        {sidebarTab === 'terminal' && <ActionsGroup />}
        {sidebarTab === 'search' && <SearchQuickAccess />}
        {sidebarTab === 'agent' && <AgentsQuickAccess />}
      </SidebarContent>
    </Sidebar>
  )
}
