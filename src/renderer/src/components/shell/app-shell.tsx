import { Button } from '@renderer/components/ui/button'
import { SidebarInset, SidebarProvider, useSidebar } from '@renderer/components/ui/sidebar'
import { trpc } from '@renderer/lib/trpc'
import { cn } from '@renderer/lib/utils'
import { usePreferencesStore } from '@renderer/stores/preferences'
import { useRepoStore } from '@renderer/stores/repo'
import { PanelLeft, PanelRight, RotateCw } from 'lucide-react'
import { useEffect } from 'react'
import { AppSidebar } from './app-sidebar'
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
  const { data: status } = trpc.updateStatus.useQuery()
  const installMutation = trpc.installUpdate.useMutation()

  if (status?.state !== 'downloaded') return null

  return (
    <Button
      size="sm"
      variant="secondary"
      className="app-no-drag m-1 h-7 self-center text-xs"
      disabled={installMutation.isLoading}
      onClick={() => installMutation.mutate()}
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

  return (
    <div className="app-drag flex h-10 items-end border-b bg-sidebar">
      <Button
        variant="ghost"
        size="icon-sm"
        onClick={left.toggle}
        aria-label="Toggle sidebar"
        className={cn(
          'app-no-drag m-1 ml-2 self-center',
          // collapsed sidebar puts this strip at the window edge, under the traffic lights
          left.collapsed && 'ml-[4.75rem]',
        )}
      >
        <PanelLeft />
      </Button>
      <TabBar />
      <UpdateButton />
      <Button
        variant="ghost"
        size="icon-sm"
        onClick={() => setRightSidebarOpen(!rightSidebarOpen)}
        aria-label="Toggle quick access sidebar"
        className="app-no-drag m-1 mr-2 self-center"
      >
        <PanelRight />
      </Button>
    </div>
  )
}

// Rendered between the providers: useSidebar here reads the outer (left) one.
function RepoShell(): React.JSX.Element {
  const { state, toggleSidebar } = useSidebar()
  const rightSidebarOpen = usePreferencesStore((s) => s.rightSidebarOpen)
  const setRightSidebarOpen = usePreferencesStore((s) => s.setRightSidebarOpen)
  const left: LeftSidebarHandle = { collapsed: state === 'collapsed', toggle: toggleSidebar }

  return (
    <SidebarInset className="h-screen min-w-0">
      <SidebarProvider
        open={rightSidebarOpen}
        onOpenChange={setRightSidebarOpen}
        shortcut="."
        className="h-full min-h-0"
        style={{ '--sidebar-width': '17rem' } as React.CSSProperties}
      >
        <div className="flex h-full min-w-0 flex-1 flex-col">
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

  useEffect(() => {
    restoreLastRepo()
  }, [restoreLastRepo])

  if (restoring) {
    return <div className="dark h-screen bg-background" />
  }

  if (!repo) {
    return (
      <div className="dark flex h-screen flex-col bg-background text-foreground">
        <div className="app-drag h-10 shrink-0" />
        <div className="min-h-0 flex-1">
          <Welcome />
        </div>
      </div>
    )
  }

  return (
    <div className="dark h-screen bg-background text-foreground">
      <SidebarProvider style={{ '--sidebar-width': `${sidebarWidth}px` } as React.CSSProperties}>
        <FileFinder />
        <AppSidebar />
        <RepoShell />
      </SidebarProvider>
    </div>
  )
}
