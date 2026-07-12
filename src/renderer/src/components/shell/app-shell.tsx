import { Button } from '@renderer/components/ui/button'
import { Kbd } from '@renderer/components/ui/kbd'
import { SidebarInset, SidebarProvider, useSidebar } from '@renderer/components/ui/sidebar'
import { Toaster } from '@renderer/components/ui/sonner'
import { Tooltip, TooltipContent, TooltipTrigger } from '@renderer/components/ui/tooltip'
import { useAgentChannel } from '@renderer/hooks/use-agent-channel'
import { useReconcileAgentTabTitles } from '@renderer/hooks/use-agents'
import { useAppEvents } from '@renderer/hooks/use-app-events'
import { useWatchOpenFiles, useWatchTreeDirs } from '@renderer/hooks/use-files'
import { useResponsiveShell } from '@renderer/hooks/use-responsive-shell'
import { useTerminalChannel } from '@renderer/hooks/use-terminal-channel'
import { useInstallUpdate, useUpdateStatus } from '@renderer/hooks/use-updates'
import { kbdLabel } from '@renderer/lib/keyboard'
import { isBrowser } from '@renderer/lib/platform'
import { cn } from '@renderer/lib/utils'
import { usePreferencesStore } from '@renderer/stores/preferences'
import { useRepoStore } from '@renderer/stores/repo'
import { useTabsStore } from '@renderer/stores/tabs'
import { PanelLeft, RotateCw, Zap } from 'lucide-react'
import { useEffect } from 'react'
import { AgentCommands } from '../agent/agent-commands'
import { CardComposer } from '../board/card-composer'
import { AppSidebar } from './app-sidebar'
import { ContentSearch } from './content-search'
import { FileCommands } from './file-commands'
import { FileFinder } from './file-finder'
import { FilePromptDialog } from './file-prompt-dialog'
import { RepoPickerDialog } from './repo-picker-dialog'
import { RightSidebar } from './right-sidebar'
import { SkillsUpdateToast } from './skills-update-toast'
import { TabBar } from './tab-bar'
import { TitleBar } from './title-bar'
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

  // The Electron auto-updater doesn't exist in the browser client.
  if (isBrowser) return null
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
  // The Board tab has no Quick Access section, so its toggle is hidden (the panel
  // itself is suppressed in RepoShell) — see RIGHT_SIDEBAR-less tabs there.
  const hasQuickAccess = usePreferencesStore((s) => s.sidebarTab !== 'board')
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
          Toggle sidebar <Kbd>{kbdLabel('mod', 'B')}</Kbd>
        </TooltipContent>
      </Tooltip>
      {isSplit ? <div className="min-w-0 flex-1 self-stretch" /> : <TabBar paneIndex={0} />}
      <UpdateButton />
      {hasQuickAccess && (
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
            Quick access <Kbd>{kbdLabel('mod', '.')}</Kbd>
          </TooltipContent>
        </Tooltip>
      )}
    </div>
  )
}

// Rendered between the providers: useSidebar here reads the outer (left) one.
function RepoShell(): React.JSX.Element {
  const { state, setOpen, toggleSidebar } = useSidebar()
  const setRightSidebarOpen = usePreferencesStore((s) => s.setRightSidebarOpen)
  const rightSidebarWidth = usePreferencesStore((s) => s.rightSidebarWidth)
  const sidebarTab = usePreferencesStore((s) => s.sidebarTab)
  // The Board tab has no Quick Access content, so the right panel is suppressed
  // there — independently of the user's open/closed preference, which is restored
  // when they switch back to a tab that has a Quick Access section.
  const rightOpen = usePreferencesStore((s) => s.rightSidebarOpen) && sidebarTab !== 'board'
  const left: LeftSidebarHandle = { collapsed: state === 'collapsed', toggle: toggleSidebar }

  // Keep the center viewer usable when the window is narrowed: close the right
  // Quick Access first, then collapse the left sidebar to its rail, restoring
  // them as the window widens (see useResponsiveShell / decideResponsiveLayout).
  useResponsiveShell({
    leftOpen: state === 'expanded',
    setLeftOpen: setOpen,
    rightSuppressed: sidebarTab === 'board',
  })

  return (
    <SidebarInset className="h-full min-h-0 min-w-0 bg-transparent">
      <SidebarProvider
        open={rightOpen}
        onOpenChange={setRightSidebarOpen}
        shortcut="."
        className="h-full min-h-0"
        style={{ '--sidebar-width': `${rightSidebarWidth}px` } as React.CSSProperties}
      >
        {/* Main tile floats in the void; margins collapse to 0 on sides where a
            floating sidebar's own padding already provides the 8px gap. */}
        <div
          className={cn(
            'glaze-tile mb-2 flex min-w-0 flex-1 flex-col overflow-hidden [--tile-fill:var(--surface-1)]',
            left.collapsed && 'ml-2',
            !rightOpen && 'mr-2',
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
  const boot = useRepoStore((s) => s.boot)

  useAppShortcuts()
  useAppEvents()
  useTerminalChannel()
  useAgentChannel()
  useReconcileAgentTabTitles()
  useWatchOpenFiles()
  useWatchTreeDirs()

  useEffect(() => {
    boot()
  }, [boot])

  if (restoring) {
    return <div className="dark h-dvh bg-background" />
  }

  if (!repo) {
    return (
      <div className="dark flex h-dvh flex-col bg-background text-foreground">
        <div className="app-drag h-12 shrink-0" />
        <div className="min-h-0 flex-1">
          <Welcome />
        </div>
        <RepoPickerDialog />
      </div>
    )
  }

  return (
    // No background wash here: the void between the tiles shows raw vibrancy. The
    // window titlebar (traffic lights + centered search) spans the top; the three
    // tiles fill the row below it.
    <div className="dark flex h-dvh flex-col text-foreground">
      <TitleBar />
      <SidebarProvider
        // flex-1 fills the row under the titlebar; minHeight:0 overrides the
        // provider's default min-h-svh (which would push the layout past the window).
        className="min-h-0 flex-1"
        style={
          {
            minHeight: 0,
            '--sidebar-width': `${sidebarWidth}px`,
            // A compact icon rail — the divider no longer runs through the header,
            // so the rail only has to fit the icons (not span under the lights).
            '--sidebar-width-icon': '3.5rem',
          } as React.CSSProperties
        }
      >
        <FileFinder />
        <ContentSearch />
        <FileCommands />
        <AgentCommands />
        <FilePromptDialog />
        <RepoPickerDialog />
        <CardComposer />
        <SkillsUpdateToast />
        <AppSidebar />
        <RepoShell />
      </SidebarProvider>
      <Toaster />
    </div>
  )
}
