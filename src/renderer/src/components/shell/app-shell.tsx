import { Button } from '@renderer/components/ui/button'
import { Kbd } from '@renderer/components/ui/kbd'
import { SidebarInset, SidebarProvider, useSidebar } from '@renderer/components/ui/sidebar'
import { Tooltip, TooltipContent, TooltipTrigger } from '@renderer/components/ui/tooltip'
import { useAppEvents } from '@renderer/hooks/use-app-events'
import { useInstallUpdate, useUpdateStatus } from '@renderer/hooks/use-updates'
import { cn } from '@renderer/lib/utils'
import { usePreferencesStore } from '@renderer/stores/preferences'
import { useRepoStore } from '@renderer/stores/repo'
import { useTabsStore } from '@renderer/stores/tabs'
import { PanelLeft, RotateCw, Zap } from 'lucide-react'
import { useEffect } from 'react'
import { AppSidebar } from './app-sidebar'
import { ContentSearch } from './content-search'
import { FileFinder } from './file-finder'
import { RightSidebar } from './right-sidebar'
import { TabBar } from './tab-bar'
import { useAppShortcuts } from './use-app-shortcuts'
import { Viewer } from './viewer'
import { Welcome } from './welcome'

interface LeftSidebarHandle {
  collapsed: boolean
  toggle: () => void
}

/** Appears only once a new release is downloaded and ready to install. */
function UpdateButton(): React.JSX.Element | null {
  const status = useUpdateStatus()
  const { install, isInstalling } = useInstallUpdate()

  if (status?.state !== 'downloaded') return null

  return (
    <Button
      size="sm"
      variant="secondary"
      className="app-no-drag m-1 h-7 self-center text-xs"
      disabled={isInstalling}
      onClick={install}
    >
      <RotateCw /> Update to {status.version}
    </Button>
  )
}

// TopBar renders inside the right sidebar's provider, so the left sidebar's
// state/toggle come in as props captured from the outer provider.
function TopBar({ left }: { left: LeftSidebarHandle }): React.JSX.Element {
  const rightSidebarOpen = usePreferencesStore((s) => s.rightSidebarOpen)
  const setRightSidebarOpen = usePreferencesStore((s) => s.setRightSidebarOpen)
  // When split, each pane carries its own tab bar inside the viewer; the chrome
  // bar shows the (single) pane's tabs otherwise.
  const isSplit = useTabsStore((s) => s.panes.length > 1)

  return (
    <div className="app-drag flex h-12 items-center border-b">
      <Tooltip>
        <TooltipTrigger
          render={
            <Button
              variant="ghost"
              size="icon-sm"
              onClick={left.toggle}
              aria-label="Toggle sidebar"
              // Collapsing leaves the icon rail in place, so the traffic lights
              // now float over the rail — this toggle never needs to clear them.
              className="app-no-drag m-1 ml-2"
            >
              <PanelLeft />
            </Button>
          }
        />
        <TooltipContent className="flex items-center gap-1.5">
          Toggle sidebar <Kbd>⌘B</Kbd>
        </TooltipContent>
      </Tooltip>
      {isSplit ? <div className="min-w-0 flex-1 self-stretch" /> : <TabBar paneIndex={0} />}
      <UpdateButton />
      <Tooltip>
        <TooltipTrigger
          render={
            <Button
              variant="ghost"
              size="icon-sm"
              onClick={() => setRightSidebarOpen(!rightSidebarOpen)}
              aria-label="Toggle quick access sidebar"
              className="app-no-drag m-1 mr-2"
            >
              <Zap />
            </Button>
          }
        />
        <TooltipContent className="flex items-center gap-1.5">
          Quick access <Kbd>⌘.</Kbd>
        </TooltipContent>
      </Tooltip>
    </div>
  )
}

// Rendered between the providers: useSidebar here reads the outer (left) one.
function RepoShell(): React.JSX.Element {
  const { state, toggleSidebar } = useSidebar()
  const rightSidebarOpen = usePreferencesStore((s) => s.rightSidebarOpen)
  const setRightSidebarOpen = usePreferencesStore((s) => s.setRightSidebarOpen)
  const rightSidebarWidth = usePreferencesStore((s) => s.rightSidebarWidth)
  const left: LeftSidebarHandle = { collapsed: state === 'collapsed', toggle: toggleSidebar }

  return (
    <SidebarInset className="h-screen min-w-0 bg-transparent">
      <SidebarProvider
        open={rightSidebarOpen}
        onOpenChange={setRightSidebarOpen}
        shortcut="."
        className="h-full min-h-0"
        style={{ '--sidebar-width': `${rightSidebarWidth}px` } as React.CSSProperties}
      >
        {/* Main tile floats in the void; margins collapse to 0 on sides where a
            floating sidebar's own padding already provides the 8px gap. */}
        <div
          className={cn(
            'glaze-tile my-2 flex min-w-0 flex-1 flex-col overflow-hidden [--tile-fill:var(--surface-1)]',
            left.collapsed && 'ml-2',
            !rightSidebarOpen && 'mr-2',
          )}
        >
          <TopBar left={left} />
          <div className="min-h-0 flex-1">
            <Viewer />
          </div>
        </div>
        <RightSidebar />
      </SidebarProvider>
    </SidebarInset>
  )
}

export function AppShell(): React.JSX.Element {
  const repo = useRepoStore((s) => s.repo)
  const sidebarWidth = usePreferencesStore((s) => s.sidebarWidth)
  const restoring = useRepoStore((s) => s.restoring)
  const restoreLastRepo = useRepoStore((s) => s.restoreLastRepo)

  useAppShortcuts()
  useAppEvents()

  useEffect(() => {
    restoreLastRepo()
  }, [restoreLastRepo])

  if (restoring) {
    return <div className="dark h-screen bg-background" />
  }

  if (!repo) {
    return (
      <div className="dark flex h-screen flex-col bg-background text-foreground">
        <div className="app-drag h-12 shrink-0" />
        <div className="min-h-0 flex-1">
          <Welcome />
        </div>
      </div>
    )
  }

  return (
    // No background wash here: the void between the tiles shows raw vibrancy
    <div className="dark h-screen text-foreground">
      <SidebarProvider
        style={
          {
            '--sidebar-width': `${sidebarWidth}px`,
            // A compact icon rail — the divider no longer runs through the header,
            // so the rail only has to fit the icons (not span under the lights).
            '--sidebar-width-icon': '3.5rem',
          } as React.CSSProperties
        }
      >
        <FileFinder />
        <ContentSearch />
        <AppSidebar />
        <RepoShell />
      </SidebarProvider>
    </div>
  )
}
