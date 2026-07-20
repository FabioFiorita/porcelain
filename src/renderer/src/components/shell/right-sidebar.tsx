import { AgentsQuickAccess } from '@renderer/components/agent/agents-quick-access'
import { ChatQuickAccess } from '@renderer/components/chat/chat-quick-access'
import { ActionsGroup } from '@renderer/components/terminal/actions-group'
import { Sidebar, SidebarContent, SidebarHeader, useSidebar } from '@renderer/components/ui/sidebar'
import { type SidebarTab, usePreferencesStore } from '@renderer/stores/preferences'
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
// dropped the "Quick Access" / "Quick Commands" labels.
const COMPANION_TITLES: Record<SidebarTab, string> = {
  files: 'Pinned & notes',
  changes: 'Commit',
  history: 'Timeline',
  // Review companion — not a git clone (P7 / U5).
  feature: 'Now reading',
  board: 'Board',
  chat: 'Coordination',
  terminal: 'Actions',
  search: 'Recent searches',
  agent: 'Session',
}

// Sections follow the left sidebar's active tab. Board keeps notes/pins so
// planning doesn't orphan the right rail (U18). Feature stays Review-native.
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
      <SidebarContent
        className={
          sidebarTab === 'files' || sidebarTab === 'board' ? 'gap-0 overflow-hidden' : undefined
        }
      >
        {(sidebarTab === 'files' || sidebarTab === 'board') && <FilesQuickAccess />}
        {(sidebarTab === 'changes' || sidebarTab === 'history') && <QuickCommandsGroup />}
        {sidebarTab === 'history' && <FileTimelineGroup />}
        {sidebarTab === 'feature' && <ReviewGroup />}
        {sidebarTab === 'changes' && <CommitGroup />}
        {(sidebarTab === 'changes' || sidebarTab === 'feature') && <CommentsGroup />}
        {sidebarTab === 'chat' && <ChatQuickAccess />}
        {sidebarTab === 'terminal' && <ActionsGroup />}
        {sidebarTab === 'search' && <SearchQuickAccess />}
        {sidebarTab === 'agent' && <AgentsQuickAccess />}
      </SidebarContent>
    </Sidebar>
  )
}
