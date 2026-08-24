import logo from '@renderer/assets/logo.png'
import { PersonalizationDialog } from '@renderer/components/settings/personalization-dialog'
import { SettingsButton } from '@renderer/components/settings/settings-dialog'
import { Button } from '@renderer/components/ui/button'
import { Shortcut } from '@renderer/components/ui/kbd'
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  useSidebar,
} from '@renderer/components/ui/sidebar'
import { WorktreeScriptsDialog } from '@renderer/features/actions'
import { HubTree } from '@renderer/features/projects'
import { isFramelessShell, isMacShell } from '@renderer/lib/platform'
import { cn } from '@renderer/lib/utils'
import { useFileFinderStore } from '@renderer/stores/file-finder'
import { useProjectPickerStore } from '@renderer/stores/project-picker'
import { TestIds } from '@shared/test-ids'
import { Plus, Search } from 'lucide-react'
import { DaemonUpdateButton } from './daemon-update-button'
import { MAC_TRAFFIC_LIGHT_CLEARANCE, sidebarTopOffsetClass } from './shell-chrome'
import { SidebarResizeHandle } from './sidebar-resize-handle'
import { UpdateButton } from './update-button'

/**
 * The left shell is deliberately navigation-only. Project/worktree selection is
 * owned by the Hub tree. Files, Git, and Canvas surfaces open their detail in the
 * Viewer; terminals dock at the bottom of it (⌘J), so they need no navigation row here.
 */
export function AppSidebar(): React.JSX.Element {
  const { state, isMobile } = useSidebar()
  const setFinderOpen = useFileFinderStore((s) => s.setOpen)

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
            <Shortcut tokens={['mod', 'K']} />
          </Button>
        </div>
        <div className="app-no-drag px-2 pt-3">
          <HubTree className="max-w-none" />
        </div>
        {/* Sibling of the tree, never a child of the menu that opens it: a closing context
            menu unmounts its content, and a dialog inside would close in the same frame. */}
        <WorktreeScriptsDialog />
        <PersonalizationDialog />
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
