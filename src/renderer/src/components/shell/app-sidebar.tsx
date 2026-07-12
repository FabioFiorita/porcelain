import { AgentList } from '@renderer/components/agent/agent-list'
import { BoardList } from '@renderer/components/board/board-list'
import { BranchSwitcher } from '@renderer/components/git/branch-switcher'
import { ChangesList } from '@renderer/components/git/changes-list'
import { FeatureList } from '@renderer/components/git/feature-list'
import { HistoryList } from '@renderer/components/git/history-list'
import { SearchList } from '@renderer/components/git/search-list'
import { WorktreeSwitcher } from '@renderer/components/git/worktree-switcher'
import { SettingsDialog } from '@renderer/components/settings/settings-dialog'
import { TerminalList } from '@renderer/components/terminal/terminal-list'
import { Button } from '@renderer/components/ui/button'
import { Kbd } from '@renderer/components/ui/kbd'
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from '@renderer/components/ui/sidebar'
import { Tooltip, TooltipContent, TooltipTrigger } from '@renderer/components/ui/tooltip'
import { kbdLabel } from '@renderer/lib/keyboard'
import { cn } from '@renderer/lib/utils'
import { useFileTreeStore } from '@renderer/stores/file-tree'
import { type SidebarTab, usePreferencesStore } from '@renderer/stores/preferences'
import { useRepoStore } from '@renderer/stores/repo'
import { isUnreadTab, useUnreadStore } from '@renderer/stores/unread'
import {
  Bot,
  ChevronsDownUp,
  Eye,
  EyeOff,
  Files,
  GitCompareArrows,
  History,
  Search,
  SquareKanban,
  SquareTerminal,
  Waypoints,
} from 'lucide-react'
import { useState } from 'react'
import { FileTree } from './file-tree'
import { ProjectSwitcher } from './project-switcher'
import { SidebarHeaderActionsProvider } from './sidebar-header-actions'
import { SidebarResizeHandle } from './sidebar-resize-handle'

const TABS: { id: SidebarTab; label: string; icon: typeof Files; shortcut: string }[] = [
  { id: 'files', label: 'Files', icon: Files, shortcut: kbdLabel('mod', '1') },
  { id: 'search', label: 'Search', icon: Search, shortcut: kbdLabel('mod', '2') },
  { id: 'changes', label: 'Changes', icon: GitCompareArrows, shortcut: kbdLabel('mod', '3') },
  { id: 'history', label: 'History', icon: History, shortcut: kbdLabel('mod', '4') },
  { id: 'feature', label: 'Feature', icon: Waypoints, shortcut: kbdLabel('mod', '5') },
  { id: 'board', label: 'Board', icon: SquareKanban, shortcut: kbdLabel('mod', '6') },
  { id: 'terminal', label: 'Terminal', icon: SquareTerminal, shortcut: kbdLabel('mod', '7') },
  { id: 'agent', label: 'Agent', icon: Bot, shortcut: kbdLabel('mod', '8') },
]

// Uppercase title each left panel opens with — one consistent header pattern
// across all eight tabs (the Files panel adds the collapse-all + hide controls).
const PANEL_TITLES: Record<SidebarTab, string> = {
  files: 'Explorer',
  changes: 'Source control',
  history: 'History',
  feature: 'Feature review',
  board: 'Board',
  terminal: 'Terminal',
  search: 'Search',
  agent: 'Agent',
}

export function AppSidebar(): React.JSX.Element {
  const repo = useRepoStore((s) => s.repo)
  const showHidden = useRepoStore((s) => s.showHidden)
  const toggleShowHidden = useRepoStore((s) => s.toggleShowHidden)
  const sidebarTab = usePreferencesStore((s) => s.sidebarTab)
  const setSidebarTab = usePreferencesStore((s) => s.setSidebarTab)
  const unread = useUnreadStore((s) => s.unread)
  const collapseAll = useFileTreeStore((s) => s.collapseAll)
  const { state, setOpen } = useSidebar()
  const [actionsSlot, setActionsSlot] = useState<HTMLElement | null>(null)

  // Picking a tab always reveals its panel — switching while collapsed to the
  // rail would otherwise change the selection with nothing visible to show for it.
  const selectTab = (tab: SidebarTab): void => {
    setSidebarTab(tab)
    setOpen(true)
  }

  return (
    // The inner tile becomes a row of two panes — the icon rail and the content
    // panel; collapsing to icon width clips the panel away, leaving just the rail.
    <Sidebar
      variant="floating"
      collapsible="icon"
      className="overflow-hidden *:data-[sidebar=sidebar]:flex-row"
      // shadcn pins the floating container to the full viewport (fixed inset-y-0
      // h-svh); offset it below the h-12 titlebar so the card sits UNDER the top
      // bar instead of riding up over the traffic lights. paddingTop:0 drops the
      // floating top gap so the tile is flush with the titlebar bottom — the search
      // then has an even 8px above (window edge) and below (to the tiles).
      // --sidebar-width-icon = the rail width: 4rem (64px) matches the mockup's
      // spacious rail (a preset re-apply resets the vendored 3rem default — set it
      // here, on the non-vendored shell, so it survives).
      style={
        {
          top: '3rem',
          height: 'calc(100svh - 3rem)',
          paddingTop: 0,
          '--sidebar-width-icon': '4rem',
        } as React.CSSProperties
      }
    >
      {/* Resizing a bare rail makes no sense — the handle only exists when expanded. */}
      {state === 'expanded' && <SidebarResizeHandle />}

      {/* Icon rail — project avatar on top, then the eight tabs (monochrome,
          icon-only), settings at the bottom. The right border runs the FULL rail
          height (on the rail itself, not its content) so the rail reads as one
          clean vertical strip — the panel's own header/footer hairlines start at
          this edge rather than crossing into the rail (matches the mockup). When
          collapsed to just the rail, there's no panel to divide from, so the
          border is dropped — otherwise it doubles against the floating tile's own
          rounded edge and reads as a stray divider. */}
      <Sidebar
        collapsible="none"
        className={cn(
          'w-(--sidebar-width-icon) shrink-0 bg-transparent',
          state === 'expanded' && 'border-r border-sidebar-border',
        )}
      >
        {/* The project switcher avatar heads the icon column as the same 40px
            chip as the tab icons — no fixed-height header, no divider; the even
            gap-1.5 rhythm alone sets it off from the tabs. Draggable around it. */}
        <SidebarHeader className="app-drag flex shrink-0 items-center justify-center p-0 pt-2.5">
          <ProjectSwitcher />
        </SidebarHeader>
        <SidebarContent className="overflow-hidden">
          <SidebarMenu className="items-center gap-1.5 pt-1.5 pb-2.5">
            {TABS.map((tab) => {
              const active = sidebarTab === tab.id
              // An agent push while this tab was unvisited lights a dot (feature/
              // board/terminal only); visiting the tab clears it (see unread.ts).
              const showDot = isUnreadTab(tab.id) && unread[tab.id]
              return (
                <SidebarMenuItem key={tab.id}>
                  <Tooltip>
                    <TooltipTrigger
                      render={
                        <SidebarMenuButton
                          isActive={active}
                          onClick={() => selectTab(tab.id)}
                          aria-label={tab.label}
                          // Rail tabs speak the porcelain glaze language, not a flat
                          // white-alpha fill: the selected tab is a lit .glaze-chip
                          // (frosted surface + hairline + specular), and a resting tab
                          // warms to that same frosted glass on hover (the .glaze-rail
                          // rule in main.css) instead of a white tint. Resting icons
                          // are muted.
                          // The vendored sidebarMenuButtonVariants shrink the
                          // button to size-8/p-2 with !important once the outer
                          // sidebar collapses to the rail — re-assert size-10/p-0
                          // (also !important) so the rail icons stay the same size
                          // collapsed or expanded.
                          className={cn(
                            'relative size-10 justify-center p-0 [&_svg]:size-5',
                            'group-data-[collapsible=icon]:size-10! group-data-[collapsible=icon]:p-0!',
                            active ? 'glaze-chip' : 'glaze-rail text-muted-foreground',
                          )}
                        >
                          <tab.icon />
                          {showDot && (
                            <span
                              aria-hidden
                              className="absolute top-1.5 right-1.5 size-1.5 rounded-full bg-foreground/70"
                            />
                          )}
                        </SidebarMenuButton>
                      }
                    />
                    <TooltipContent side="right" className="flex items-center gap-1.5">
                      {tab.label} <Kbd>{tab.shortcut}</Kbd>
                    </TooltipContent>
                  </Tooltip>
                </SidebarMenuItem>
              )
            })}
          </SidebarMenu>
        </SidebarContent>
        {/* Settings sits clean at the rail bottom — no top hairline. The footer
            line belongs to the panel only; the rail's full-height right border is
            what separates this from the branch/worktree footer beside it. h-12
            still keeps it vertically aligned with that footer. */}
        <SidebarFooter className="h-12 items-center justify-center p-0">
          <SettingsDialog />
        </SidebarFooter>
      </Sidebar>

      {/* Content panel — contextual header + active list + branch/worktree footer. */}
      <SidebarHeaderActionsProvider value={actionsSlot}>
        <Sidebar collapsible="none" className="min-w-0 flex-1 bg-transparent">
          {/* Contextual title bar. The traffic lights now live in the window
            titlebar, so the panel header is free of them — no left inset needed. */}
          <SidebarHeader
            className={cn(
              'app-drag h-12 flex-row items-center gap-1 py-0 pr-1 pl-3',
              state === 'expanded' && 'border-b',
            )}
          >
            <span className="min-w-0 flex-1 truncate text-xs font-semibold text-foreground">
              {PANEL_TITLES[sidebarTab]}
            </span>
            {/* One actions region for every tab. Files renders its tree controls
              inline here; the other tabs portal their header buttons into the
              slot below (see SidebarHeaderActions) so no tab grows a second
              toolbar row beneath the title. */}
            <div className="app-no-drag flex shrink-0 items-center text-muted-foreground">
              {sidebarTab === 'files' && (
                <>
                  <Tooltip>
                    <TooltipTrigger
                      render={
                        <Button
                          variant="ghost"
                          size="icon-sm"
                          onClick={collapseAll}
                          aria-label="Collapse all folders"
                        >
                          <ChevronsDownUp />
                        </Button>
                      }
                    />
                    <TooltipContent>Collapse all folders</TooltipContent>
                  </Tooltip>
                  <Tooltip>
                    <TooltipTrigger
                      render={
                        <Button
                          variant="ghost"
                          size="icon-sm"
                          onClick={toggleShowHidden}
                          aria-label={showHidden ? 'Conceal hidden entries' : 'Show hidden entries'}
                        >
                          {showHidden ? <Eye /> : <EyeOff />}
                        </Button>
                      }
                    />
                    <TooltipContent>
                      {showHidden ? 'Conceal hidden entries' : 'Show hidden entries'}
                    </TooltipContent>
                  </Tooltip>
                </>
              )}
              <div ref={setActionsSlot} className="flex items-center" />
            </div>
          </SidebarHeader>
          <SidebarContent className="overflow-hidden">
            {repo ? (
              <div className="min-h-0 flex-1 overflow-auto">
                <SidebarGroup>
                  <SidebarGroupContent>
                    {/* The tree stays MOUNTED across tab switches (hidden via CSS,
                        not unmounted) — folder expansion is per-DirNode local
                        state, so unmounting would collapse everything the user
                        had opened. The other tabs keep conditional rendering. */}
                    <div className={cn(sidebarTab !== 'files' && 'hidden')}>
                      <FileTree rootPath={repo.path} />
                    </div>
                    {sidebarTab === 'changes' && <ChangesList />}
                    {sidebarTab === 'history' && <HistoryList />}
                    {sidebarTab === 'feature' && <FeatureList />}
                    {sidebarTab === 'board' && <BoardList />}
                    {sidebarTab === 'terminal' && <TerminalList />}
                    {sidebarTab === 'search' && <SearchList />}
                    {sidebarTab === 'agent' && <AgentList />}
                  </SidebarGroupContent>
                </SidebarGroup>
              </div>
            ) : (
              <p className="p-2 text-sm text-muted-foreground">No repository open</p>
            )}
          </SidebarContent>
          {/* Branch picker (in-place checkout) on the left, worktree switcher on the right. */}
          <SidebarFooter
            className={cn(
              'h-12 flex-row items-center justify-between gap-2 px-2 py-0',
              state === 'expanded' && 'border-t',
            )}
          >
            <BranchSwitcher />
            <WorktreeSwitcher />
          </SidebarFooter>
        </Sidebar>
      </SidebarHeaderActionsProvider>
    </Sidebar>
  )
}
