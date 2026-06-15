import { ChangesList } from '@renderer/components/git/changes-list'
import { FeatureList } from '@renderer/components/git/feature-list'
import { HistoryList } from '@renderer/components/git/history-list'
import { WorktreeSwitcher } from '@renderer/components/git/worktree-switcher'
import { SettingsDialog } from '@renderer/components/settings/settings-dialog'
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
import { type SidebarTab, usePreferencesStore } from '@renderer/stores/preferences'
import { useRepoStore } from '@renderer/stores/repo'
import { Eye, EyeOff, Files, GitCompareArrows, History, Waypoints } from 'lucide-react'
import { FileTree } from './file-tree'
import { ProjectSwitcher } from './project-switcher'
import { SidebarResizeHandle } from './sidebar-resize-handle'

const TABS: { id: SidebarTab; label: string; icon: typeof Files; shortcut: string }[] = [
  { id: 'files', label: 'Files', icon: Files, shortcut: '⌘1' },
  { id: 'changes', label: 'Changes', icon: GitCompareArrows, shortcut: '⌘2' },
  { id: 'history', label: 'History', icon: History, shortcut: '⌘3' },
  { id: 'feature', label: 'Feature', icon: Waypoints, shortcut: '⌘4' },
]

export function AppSidebar(): React.JSX.Element {
  const repo = useRepoStore((s) => s.repo)
  const showHidden = useRepoStore((s) => s.showHidden)
  const toggleShowHidden = useRepoStore((s) => s.toggleShowHidden)
  const sidebarTab = usePreferencesStore((s) => s.sidebarTab)
  const setSidebarTab = usePreferencesStore((s) => s.setSidebarTab)
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
    >
      {/* Resizing a bare rail makes no sense — the handle only exists when expanded. */}
      {state === 'expanded' && <SidebarResizeHandle />}

      {/* Icon rail — the four tabs, monochrome and icon-only, plus settings.
          The divider lives on the content (not the whole rail) so it starts
          below the header line and stops above the footer — the title bar and
          bottom bar read as one continuous strip across rail + panel. */}
      <Sidebar collapsible="none" className="w-(--sidebar-width-icon) shrink-0 bg-transparent">
        {/* Empty drag strip the macOS traffic lights float over. */}
        <SidebarHeader className="app-drag h-12 shrink-0 border-b" />
        <SidebarContent className="overflow-hidden border-r border-sidebar-border">
          <SidebarMenu className="items-center gap-1 py-2">
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
                            'size-9 justify-center p-0',
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
        {/* h-12 mirrors the panel footer so the two border-t lines line up. */}
        <SidebarFooter className="h-12 items-center justify-center border-t p-0">
          <SettingsDialog />
        </SidebarFooter>
      </Sidebar>

      {/* Content panel — project switcher + active list + branch switcher. */}
      <Sidebar collapsible="none" className="min-w-0 flex-1 bg-transparent">
        {/* Continuous title bar. The traffic lights own the left edge and
            overhang the panel slightly, so pl-7 holds the switcher clear of them
            with a comfortable gap; it fills the width and aligns to the start
            (left of the eye), truncating rather than tucking under the lights. */}
        <SidebarHeader className="app-drag h-12 flex-row items-center gap-0 border-b py-0 pl-7 pr-1">
          <div className="flex min-w-0 flex-1 justify-start">
            <ProjectSwitcher />
          </div>
          <div className="app-no-drag flex shrink-0 items-center">
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
                </SidebarGroupContent>
              </SidebarGroup>
            </div>
          ) : (
            <p className="p-2 text-sm text-muted-foreground">No repository open</p>
          )}
        </SidebarContent>
        <SidebarFooter className="h-12 items-end justify-center border-t px-2 py-0">
          <WorktreeSwitcher />
        </SidebarFooter>
      </Sidebar>
    </Sidebar>
  )
}
