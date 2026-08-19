import logo from '@renderer/assets/logo.png'
import { SettingsButton } from '@renderer/components/settings/settings-dialog'
import { Button } from '@renderer/components/ui/button'
import { Kbd } from '@renderer/components/ui/kbd'
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  useSidebar,
} from '@renderer/components/ui/sidebar'
import { HubTree } from '@renderer/features/projects'
import { openTasksBoard } from '@renderer/features/tasks'
import { kbdLabel } from '@renderer/lib/keyboard'
import { isFramelessShell, isMacShell } from '@renderer/lib/platform'
import { cn } from '@renderer/lib/utils'
import { useFileFinderStore } from '@renderer/stores/file-finder'
import { useNewTaskDialogStore } from '@renderer/stores/new-task-dialog'
import { useProjectPickerStore } from '@renderer/stores/project-picker'
import { useTabsStore } from '@renderer/stores/tabs'
import { useUnreadStore } from '@renderer/stores/unread'
import { TestIds } from '@shared/test-ids'
import { Plus, Search, Table2 } from 'lucide-react'
import { MAC_TRAFFIC_LIGHT_CLEARANCE, sidebarTopOffsetClass } from './shell-chrome'
import { DaemonUpdateButton } from './daemon-update-button'
import { SidebarResizeHandle } from './sidebar-resize-handle'
import { UpdateButton } from './update-button'

/**
 * The left shell is deliberately navigation-only. Project/worktree selection is
 * owned by the Hub tree. Tasks is daemon-wide and lives here, not in Surfaces.
 * Files, Git, Canvas, and terminal surfaces open their detail in the Viewer.
 */
export function AppSidebar(): React.JSX.Element {
  const { state, isMobile } = useSidebar()
  const setFinderOpen = useFileFinderStore((s) => s.setOpen)
  const tasksActive = useTabsStore((s) => {
    const pane = s.panes[s.activePaneIndex]
    return pane?.tabs.find((tab) => tab.id === pane.activeTabId)?.kind === 'tasks'
  })
  const tasksUnread = useUnreadStore((s) => s.unread.tasks)
  const showNewTask = useNewTaskDialogStore((s) => s.show)

  return (
    <Sidebar
      variant="floating"
      collapsible="offcanvas"
      className={cn(
        'overflow-hidden md:pt-[9px] md:pb-[9px]',
        // macOS's traffic lights are native: they overlay this header's reserved left
        // padding below rather than pushing content down. See shell-chrome.ts.
        sidebarTopOffsetClass(isFramelessShell),
      )}
    >
      {state === 'expanded' && !isMobile && <SidebarResizeHandle />}
      <SidebarHeader
        className={cn(
          'app-drag h-12 shrink-0 flex-row items-center gap-2 border-b py-0 pr-3',
          // This header sits flush at the window's true top-left corner on macOS, so it
          // owns the traffic-light clearance while the sidebar is open. viewer-header.tsx
          // takes over the moment this collapses.
          isMacShell ? MAC_TRAFFIC_LIGHT_CLEARANCE : 'pl-3',
        )}
      >
        <img src={logo} alt="" draggable={false} className="size-6 shrink-0" />
        <span className="truncate text-sm font-semibold text-foreground">Porcelain</span>
        <div className="app-no-drag ml-auto flex shrink-0 items-center gap-1.5">
          <DaemonUpdateButton />
          <UpdateButton />
          <Button
            variant="ghost"
            size="icon-sm"
            className="text-muted-foreground"
            aria-label="Add project"
            data-testid={TestIds.hubAddProject}
            onClick={() => useProjectPickerStore.getState().show()}
          >
            <Plus />
          </Button>
        </div>
      </SidebarHeader>
      <SidebarContent className="gap-0">
        <div className="app-no-drag px-2 pt-2">
          <Button
            variant="outline"
            className="h-8 w-full justify-start gap-2 px-2 text-xs text-muted-foreground"
            onClick={() => setFinderOpen(true)}
            aria-label="Search commands, projects, files, and commits"
          >
            <Search className="size-3.5" />
            <span className="min-w-0 flex-1 truncate text-left">Search</span>
            <Kbd>{kbdLabel('mod', 'K')}</Kbd>
          </Button>
        </div>
        <div className="app-no-drag px-2 pt-2">
          <div className="flex items-center gap-1">
            <button
              type="button"
              data-testid={TestIds.tasksOpen}
              aria-label="Open Tasks"
              aria-current={tasksActive ? 'page' : undefined}
              className={cn(
                'flex h-8 min-w-0 flex-1 items-center gap-2 rounded-md px-2 text-left text-xs',
                tasksActive
                  ? 'bg-sidebar-accent text-sidebar-accent-foreground'
                  : 'text-muted-foreground hover:bg-sidebar-accent/50',
              )}
              onClick={() => openTasksBoard()}
            >
              <Table2 className="size-3.5 shrink-0" />
              <span className="min-w-0 flex-1 truncate">Tasks</span>
              {tasksUnread && (
                <span className="size-1.5 shrink-0 rounded-full bg-foreground" aria-hidden />
              )}
              <Kbd>{kbdLabel('mod', 'shift', 'T')}</Kbd>
            </button>
            <Button
              variant="ghost"
              size="icon-xs"
              className="shrink-0"
              aria-label="New Task"
              data-testid={TestIds.tasksNew}
              onClick={() => showNewTask()}
            >
              <Plus />
            </Button>
          </div>
        </div>
        <div className="app-no-drag px-2 pt-3">
          <HubTree className="max-w-none" />
        </div>
      </SidebarContent>
      <SidebarFooter className="shrink-0 border-t px-2 py-2">
        <SettingsButton
          showLabel
          className="app-no-drag h-8 w-full justify-start gap-2 px-2 text-xs text-muted-foreground"
          data-testid={TestIds.railSettings}
        />
      </SidebarFooter>
    </Sidebar>
  )
}
