import { Button } from '@renderer/components/ui/button'
import { Kbd } from '@renderer/components/ui/kbd'
import { SidebarInset, SidebarProvider, useSidebar } from '@renderer/components/ui/sidebar'
import { Toaster } from '@renderer/components/ui/sonner'
import { Tooltip, TooltipContent, TooltipTrigger } from '@renderer/components/ui/tooltip'
import { CardComposer, useBoardNotificationSubscription } from '@renderer/features/board'
import { useFilesInterestBridge, useFilesNotificationSubscription } from '@renderer/features/files'
import { useGitNotificationSubscription } from '@renderer/features/git'
import { useReviewCommentNotificationSubscription } from '@renderer/features/review/comments'
import { useTerminalRoster } from '@renderer/features/terminal'
import { useDocumentTitle } from '@renderer/hooks/use-document-title'
import { useEnvironmentStatuses } from '@renderer/hooks/use-environment-status'
import { useResponsiveShell } from '@renderer/hooks/use-responsive-shell'
import { useSessionRuntime } from '@renderer/hooks/use-session-runtime'
import { useShellEvents } from '@renderer/hooks/use-shell-events'
import { useThemeSync } from '@renderer/hooks/use-theme'
import { kbdLabel } from '@renderer/lib/keyboard'
import { cn } from '@renderer/lib/utils'
import { usePreferencesStore } from '@renderer/stores/preferences'
import { useRepoStore } from '@renderer/stores/repo'
import { useTabsStore } from '@renderer/stores/tabs'
import { useZenStore } from '@renderer/stores/zen'
import { TestIds } from '@shared/test-ids'
import { PanelLeft, Zap } from 'lucide-react'
import { useEffect, useRef } from 'react'
import { SettingsDialog } from '../settings/settings-dialog'
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

// TopBar renders inside the right sidebar's provider, so the left sidebar's
// state/toggle come in as props captured from the outer provider. The right
// toggle MUST go through this provider's `toggleSidebar` — on phone that flips
// `openMobile` (the sheet); writing the preference alone leaves the sheet closed.
// App-update install lives in TitleBar (shell chrome), not here (document chrome).
function TopBar({ left }: { left: LeftSidebarHandle }): React.JSX.Element {
  const { toggleSidebar: toggleRight, isMobile, openMobile, open: rightOpen } = useSidebar()
  // When split, each pane carries its own tab bar inside the viewer; the chrome
  // bar shows the (single) pane's tabs otherwise.
  const isSplit = useTabsStore((s) => s.panes.length > 1)
  const rightActive = isMobile ? openMobile : rightOpen

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
              aria-expanded={!left.collapsed}
              data-testid={TestIds.toggleLeftSidebar}
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
      {/* Every tab has a companion rail (Board = Focus card detail), so the bolt is
          unconditional — the rail retitles itself instead of disappearing. */}
      <Tooltip>
        <TooltipTrigger
          render={
            <Button
              variant="ghost"
              size="icon-sm"
              onClick={() => {
                toggleRight()
              }}
              aria-label="Toggle quick access sidebar"
              aria-expanded={rightActive}
              data-testid={TestIds.toggleRightSidebar}
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
    </div>
  )
}

// Rendered between the providers: useSidebar here reads the outer (left) one.
function RepoShell(): React.JSX.Element {
  const { state, setOpen, toggleSidebar, isMobile, openMobile } = useSidebar()
  const setRightSidebarOpen = usePreferencesStore((s) => s.setRightSidebarOpen)
  const rightSidebarWidth = usePreferencesStore((s) => s.rightSidebarWidth)
  // One open/closed preference for every tab: the rail is never suppressed per tab,
  // so switching tabs swaps its content, never its visibility.
  const rightOpen = usePreferencesStore((s) => s.rightSidebarOpen)
  // On phone the left panel is a sheet (`openMobile`), not the desktop expanded flag.
  const left: LeftSidebarHandle = {
    collapsed: isMobile ? !openMobile : state === 'collapsed',
    toggle: toggleSidebar,
  }

  // Keep the center viewer usable when the window is narrowed: close the right
  // Quick Access first, then collapse the left sidebar to its rail, restoring
  // them as the window widens (see useResponsiveShell / decideResponsiveLayout).
  useResponsiveShell({ leftOpen: state === 'expanded', setLeftOpen: setOpen })

  // Zen mode (Z in the Review document): collapse both sidebars, restoring their
  // previous open state on the second Z. Consumed HERE because this is the one
  // place both SidebarProviders are reachable — the left one's setOpen via the
  // outer useSidebar, the right one via its controlling preference. Desktop-only:
  // on phone both panels are overlay sheets (`openMobile`), already out of the
  // way, and toggling the desktop flags would silently flip the stored prefs.
  const zen = useZenStore((s) => s.zen)
  const zenRestore = useRef<{ left: boolean; right: boolean } | null>(null)
  const leftOpenRef = useRef(state === 'expanded')
  useEffect(() => {
    leftOpenRef.current = state === 'expanded'
  })
  useEffect(() => {
    if (isMobile) return
    if (zen) {
      zenRestore.current = {
        left: leftOpenRef.current,
        right: usePreferencesStore.getState().rightSidebarOpen,
      }
      setOpen(false)
      setRightSidebarOpen(false)
    } else if (zenRestore.current) {
      setOpen(zenRestore.current.left)
      setRightSidebarOpen(zenRestore.current.right)
      zenRestore.current = null
    }
  }, [zen, isMobile, setOpen, setRightSidebarOpen])

  return (
    <SidebarInset className="h-full min-h-0 min-w-0">
      <SidebarProvider
        open={rightOpen}
        onOpenChange={setRightSidebarOpen}
        shortcut="."
        className="h-full min-h-0"
        style={{ '--sidebar-width': `${rightSidebarWidth}px` } as React.CSSProperties}
      >
        {/* Main tile; margins collapse to 0 on sides where a floating sidebar's
            own padding already provides the 8px gap. On phone both sidebars are
            overlay sheets (no gap peer), so always keep the 8px margin on both
            sides. */}
        <div
          data-testid={TestIds.viewerCard}
          className={cn(
            'mb-2 flex min-w-0 flex-1 flex-col overflow-hidden rounded-xl border bg-card',
            (isMobile || left.collapsed) && 'ml-2',
            (isMobile || !rightOpen) && 'mr-2',
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
  useShellEvents()
  // One session runtime for the window: domain change invalidation, watch interests,
  // project selection, and reconnect recovery. Terminal traffic shares the same socket.
  useSessionRuntime()
  // Board notifications own their cards-identity invalidation (BRD-004); not session-runtime.
  useBoardNotificationSubscription()
  // Git workspace notifications own typed Git identities; session-runtime handles only residual
  // non-Git recovery and Review/Files cross-domain concerns.
  useGitNotificationSubscription()
  // Comments notifications own their comments-identity invalidation (RVC-003); bulk review.changed
  // in session-runtime no longer touches comments.
  useReviewCommentNotificationSubscription()
  // Files notifications + watch interests (FIL-005); session-runtime Files arms are no-ops.
  useFilesNotificationSubscription()
  useFilesInterestBridge()
  useEnvironmentStatuses()
  useThemeSync()
  useDocumentTitle()
  useTerminalRoster()

  useEffect(() => {
    boot()
  }, [boot])

  if (restoring) {
    return <div className="h-dvh bg-background" />
  }

  // SettingsDialog is mounted on BOTH paths: remote-daemon connect/disconnect lives
  // there, and a stuck remote (or empty recents) must not lock the user out of it.
  // The gear triggers (sidebar rail + welcome) only open the store.
  // Safe-area padding keeps the browser client clear of the iPhone notch / home bar
  // (viewport-fit=cover in index.html); inert on desktop Electron (env() → 0).
  if (!repo) {
    return (
      <div className="flex h-dvh flex-col bg-background pt-[env(safe-area-inset-top)] pb-[env(safe-area-inset-bottom)] text-foreground">
        <div className="app-drag h-12 shrink-0" />
        <div className="min-h-0 flex-1">
          <Welcome />
        </div>
        <RepoPickerDialog />
        <SettingsDialog />
        <Toaster />
      </div>
    )
  }

  return (
    // The window titlebar (traffic lights + centered search) spans the top; the
    // three tiles fill the row below it over the app background.
    <div className="flex h-dvh flex-col bg-background pt-[env(safe-area-inset-top)] pb-[env(safe-area-inset-bottom)] text-foreground">
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
        <FilePromptDialog />
        <RepoPickerDialog />
        <CardComposer />
        <SkillsUpdateToast />
        <SettingsDialog />
        <AppSidebar />
        <RepoShell />
      </SidebarProvider>
      <Toaster />
    </div>
  )
}
