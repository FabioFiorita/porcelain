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
import { kbdLabel } from '@renderer/lib/keyboard'
import { isBrowser } from '@renderer/lib/platform'
import { cn } from '@renderer/lib/utils'
import { useFileFinderStore } from '@renderer/stores/file-finder'
import { useProjectPickerStore } from '@renderer/stores/project-picker'
import { TestIds } from '@shared/test-ids'
import { Plus, Search } from 'lucide-react'
import { SidebarResizeHandle } from './sidebar-resize-handle'

/**
 * The left shell is deliberately navigation-only. Project/worktree selection is
 * owned by the Hub tree; files, Git, terminals, Review, and Board live in the
 * right surface sidebar and open their detail in the central Viewer.
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
        isBrowser
          ? 'md:top-[env(safe-area-inset-top)] md:h-[calc(100dvh-env(safe-area-inset-top)-env(safe-area-inset-bottom))]'
          : 'md:top-[calc(3rem+env(safe-area-inset-top))] md:h-[calc(100dvh-3rem-env(safe-area-inset-top)-env(safe-area-inset-bottom))]',
      )}
    >
      {state === 'expanded' && !isMobile && <SidebarResizeHandle />}
      <SidebarHeader className="app-drag h-12 shrink-0 flex-row items-center gap-2 border-b py-0 px-3">
        <img src={logo} alt="" draggable={false} className="size-6 shrink-0" />
        <span className="truncate text-sm font-semibold text-foreground">Porcelain</span>
        <Button
          variant="ghost"
          size="icon-sm"
          className="app-no-drag ml-auto shrink-0 text-muted-foreground"
          aria-label="Add project"
          data-testid={TestIds.hubAddProject}
          onClick={() => useProjectPickerStore.getState().show()}
        >
          <Plus />
        </Button>
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
