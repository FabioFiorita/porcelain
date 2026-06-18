import { BoardList } from '@renderer/components/board/board-list'
import { BranchSwitcher } from '@renderer/components/git/branch-switcher'
import { ChangesList } from '@renderer/components/git/changes-list'
import { FeatureList } from '@renderer/components/git/feature-list'
import { HistoryList } from '@renderer/components/git/history-list'
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
import { cn } from '@renderer/lib/utils'
import { useFileTreeStore } from '@renderer/stores/file-tree'
import { type SidebarTab, usePreferencesStore } from '@renderer/stores/preferences'
import { useRepoStore } from '@renderer/stores/repo'
import {
  ChevronsDownUp,
  Eye,
  EyeOff,
  Files,
  GitCompareArrows,
  History,
  SquareKanban,
  SquareTerminal,
  Waypoints,
} from 'lucide-react'
import { FileTree } from './file-tree'
import { ProjectSwitcher } from './project-switcher'
import { SidebarResizeHandle } from './sidebar-resize-handle'

const TABS: { id: SidebarTab; label: string; icon: typeof Files; shortcut: string }[] = [
  { id: 'files', label: 'Files', icon: Files, shortcut: '⌘1' },
  { id: 'changes', label: 'Changes', icon: GitCompareArrows, shortcut: '⌘2' },
  { id: 'history', label: 'History', icon: History, shortcut: '⌘3' },
  { id: 'feature', label: 'Feature', icon: Waypoints, shortcut: '⌘4' },
  { id: 'board', label: 'Board', icon: SquareKanban, shortcut: '⌘5' },
  { id: 'terminal', label: 'Terminal', icon: SquareTerminal, shortcut: '⌘6' },
]

// Uppercase title each left panel opens with — one consistent header pattern
// across all six tabs (the Files panel adds the collapse-all + hide controls).
const PANEL_TITLES: Record<SidebarTab, string> = {
  files: 'Explorer',
  changes: 'Source control',
  history: 'History',
  feature: 'Feature review',
  board: 'Board',
  terminal: 'Terminal',
}

export function AppSidebar(): React.JSX.Element {
  const repo = useRepoStore((s) => s.repo)
  const showHidden = useRepoStore((s) => s.showHidden)
  const toggleShowHidden = useRepoStore((s) => s.toggleShowHidden)
  const sidebarTab = usePreferencesStore((s) => s.sidebarTab)
  const setSidebarTab = usePreferencesStore((s) => s.setSidebarTab)
  const collapseAll = useFileTreeStore((s) => s.collapseAll)
  const { state, setOpen } = useSidebar()

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

      {/* Icon rail — project avatar on top, then the six tabs (monochrome,
          icon-only), settings at the bottom. The right border runs the FULL rail
          height (on the rail itself, not its content) so the rail reads as one
          clean vertical strip — the panel's own header/footer hairlines start at
          this edge rather than crossing into the rail (matches the mockup). */}
      <Sidebar
        collapsible="none"
        className="w-(--sidebar-width-icon) shrink-0 border-r border-sidebar-border bg-transparent"
      >
        {/* The project switcher avatar; the strip stays draggable around it. No
            header border here — the mockup separates the avatar from the tabs with
            a short centered divider (below) rather than a full-width header line. */}
        <SidebarHeader className="app-drag flex h-12 shrink-0 items-center justify-center">
          <ProjectSwitcher />
        </SidebarHeader>
        <SidebarContent className="overflow-hidden">
          {/* short centered divider below the avatar (mockup) */}
          <div className="mx-auto h-px w-7 shrink-0 bg-sidebar-border" />
          <SidebarMenu className="items-center gap-1.5 py-2.5">
            {TABS.map((tab) => {
              const active = sidebarTab === tab.id
              return (
                <SidebarMenuItem key={tab.id}>
                  <Tooltip>
                    <TooltipTrigger
                      render={
                        <SidebarMenuButton
                          isActive={active}
                          onClick={() => selectTab(tab.id)}
                          aria-label={tab.label}
                          className={cn(
                            'size-10 justify-center p-0 [&_svg]:size-5',
                            !active && 'text-muted-foreground',
                          )}
                        >
                          <tab.icon />
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
      <Sidebar collapsible="none" className="min-w-0 flex-1 bg-transparent">
        {/* Contextual title bar. The traffic lights now live in the window
            titlebar, so the panel header is free of them — no left inset needed. */}
        <SidebarHeader className="app-drag h-12 flex-row items-center gap-1 border-b py-0 pr-1 pl-3">
          <span className="min-w-0 flex-1 truncate text-xs font-semibold text-foreground">
            {PANEL_TITLES[sidebarTab]}
          </span>
          {sidebarTab === 'files' && (
            <div className="app-no-drag flex shrink-0 items-center text-muted-foreground">
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
            </div>
          )}
        </SidebarHeader>
        <SidebarContent className="overflow-hidden">
          {repo ? (
            <div className="min-h-0 flex-1 overflow-auto">
              <SidebarGroup>
                <SidebarGroupContent>
                  {sidebarTab === 'files' && <FileTree rootPath={repo.path} />}
                  {sidebarTab === 'changes' && <ChangesList />}
                  {sidebarTab === 'history' && <HistoryList />}
                  {sidebarTab === 'feature' && <FeatureList />}
                  {sidebarTab === 'board' && <BoardList />}
                  {sidebarTab === 'terminal' && <TerminalList />}
                </SidebarGroupContent>
              </SidebarGroup>
            </div>
          ) : (
            <p className="p-2 text-sm text-muted-foreground">No repository open</p>
          )}
        </SidebarContent>
        {/* Branch picker (in-place checkout) on the left, worktree switcher on the right. */}
        <SidebarFooter className="h-12 flex-row items-center justify-between gap-2 border-t px-2 py-0">
          <BranchSwitcher />
          <WorktreeSwitcher />
        </SidebarFooter>
      </Sidebar>
    </Sidebar>
  )
}
