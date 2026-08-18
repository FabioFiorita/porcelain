import { TerminalPanel } from '@renderer/components/terminal/terminal-list'
import { SidebarInset, SidebarProvider, useSidebar } from '@renderer/components/ui/sidebar'
import { Toaster } from '@renderer/components/ui/sonner'
import { useActionsNotificationSubscription } from '@renderer/features/actions'
import { useFilesInterestBridge, useFilesNotificationSubscription } from '@renderer/features/files'
import { useGitNotificationSubscription } from '@renderer/features/git'
import { useEnvironmentStatuses } from '@renderer/features/remote'
import { useReviewCommentNotificationSubscription } from '@renderer/features/review'
import {
  ContentSearch,
  FileFinder,
  useSearchNotificationSubscription,
} from '@renderer/features/search'
import { NewTaskDialog, useTasksNotificationSubscription } from '@renderer/features/tasks'
import {
  useDevServersNotificationSubscription,
  useTerminalRoster,
} from '@renderer/features/terminal'
import { useDocumentTitle } from '@renderer/hooks/use-document-title'
import { useResponsiveShell } from '@renderer/hooks/use-responsive-shell'
import { useSessionRuntime } from '@renderer/hooks/use-session-runtime'
import { useShellEvents } from '@renderer/hooks/use-shell-events'
import { useThemeSync } from '@renderer/hooks/use-theme'
import { isFramelessShell } from '@renderer/lib/platform'
import { cn } from '@renderer/lib/utils'
import { useHubSelectionStore } from '@renderer/stores/hub-selection'
import { usePreferencesStore } from '@renderer/stores/preferences'
import { useProjectSelectionStore } from '@renderer/stores/project-selection'
import { useZenStore } from '@renderer/stores/zen'
import { TestIds } from '@shared/test-ids'
import { useEffect, useRef } from 'react'
import { SettingsDialog } from '../settings/settings-dialog'
import { AppSidebar } from './app-sidebar'
import { FileCommands } from './file-commands'
import { FilePromptDialog } from './file-prompt-dialog'
import { ProjectPickerDialog } from './project-picker-dialog'
import { RightSidebar } from './right-sidebar'
import { TitleBar } from './title-bar'
import { useAppShortcuts } from './use-app-shortcuts'
import { Viewer } from './viewer'
import { ViewerHeader } from './viewer-header'

// Rendered between the providers: useSidebar here reads the outer (left) one.
function RepoShell(): React.JSX.Element {
  const { state, setOpen, toggleSidebar, isMobile, openMobile } = useSidebar()
  const setRightSidebarOpen = usePreferencesStore((s) => s.setRightSidebarOpen)
  const rightSidebarWidth = usePreferencesStore((s) => s.rightSidebarWidth)
  // One open/closed preference for the right surface sidebar; switching surfaces
  // changes its active tab without changing its visibility.
  const rightOpen = usePreferencesStore((s) => s.rightSidebarOpen)
  // On phone the left panel is a sheet (`openMobile`), not the desktop expanded flag.
  const left = {
    collapsed: isMobile ? !openMobile : state === 'collapsed',
    toggle: toggleSidebar,
  }

  // Keep the center viewer usable when the window is narrowed: close the right
  // Surface sidebar first, then close the left navigation, restoring
  // them as the window widens (see useResponsiveShell / decideResponsiveLayout).
  useResponsiveShell({ leftOpen: state === 'expanded', setLeftOpen: setOpen })

  // Zen mode (Z in the Canvas document): collapse both sidebars, restoring their
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
            'mt-2 mb-2 flex min-w-0 flex-1 flex-col overflow-hidden rounded-xl border bg-card',
            (isMobile || left.collapsed) && 'ml-2',
            (isMobile || !rightOpen) && 'mr-2',
          )}
        >
          <ViewerHeader left={left} />
          <div className="min-h-0 flex-1">
            <Viewer />
          </div>
          <TerminalPanel />
        </div>
        <RightSidebar />
      </SidebarProvider>
    </SidebarInset>
  )
}

export function AppShell(): React.JSX.Element {
  const sidebarWidth = usePreferencesStore((s) => s.sidebarWidth)
  const restoring = useProjectSelectionStore((s) => s.restoring)
  const boot = useProjectSelectionStore((s) => s.boot)

  useAppShortcuts()
  useShellEvents()
  // One session runtime for the window: domain change invalidation, watch interests,
  // project selection, and reconnect recovery. Terminal traffic shares the same socket.
  useSessionRuntime()
  useTasksNotificationSubscription()
  // Git workspace notifications own typed Git identities; session-runtime handles only residual
  // non-Git recovery and Canvas/Files cross-domain concerns.
  useGitNotificationSubscription()
  useReviewCommentNotificationSubscription()
  // Files notifications + watch interests (FIL-005); session-runtime Files arms are no-ops.
  useFilesNotificationSubscription()
  // Search owns its typed Search identities, Files facts, and recovery invalidation.
  useSearchNotificationSubscription()
  // Actions owns list invalidation (ACT-003); session-runtime actions.changed is a no-op.
  useActionsNotificationSubscription()
  useFilesInterestBridge()
  useEnvironmentStatuses()
  useThemeSync()
  useDocumentTitle()
  useTerminalRoster()
  useDevServersNotificationSubscription()

  useEffect(() => {
    const selection = useHubSelectionStore.getState().selection
    boot(selection.kind === 'worktree' ? selection.path : undefined)
  }, [boot])

  if (restoring) {
    return <div className="h-dvh bg-background" />
  }

  // SettingsDialog is mounted on BOTH paths: remote-daemon connect/disconnect lives
  // there, and a stuck remote (or empty recents) must not lock the user out of it.
  // The gear triggers (navigation sidebar + welcome) only open the store.
  // Safe-area padding keeps the browser client clear of the iPhone notch / home bar
  // (viewport-fit=cover in index.html); inert on desktop Electron (env() → 0).
  return (
    // Everyone but the frameless shell (Linux/Windows) starts at the true window top:
    // the browser has no native window chrome to clear, and macOS's traffic lights are
    // native (no drawn row needed — whichever chrome reaches the top-left reserves space
    // for them itself). Only a frameless window draws its own titlebar row, for the drag
    // region + window controls.
    <div className="flex h-dvh flex-col bg-background pt-[env(safe-area-inset-top)] pb-[env(safe-area-inset-bottom)] text-foreground">
      {isFramelessShell && <TitleBar />}
      <SidebarProvider
        // flex-1 fills the row under the drawn titlebar when a frameless shell provides
        // one; minHeight:0 overrides the
        // provider's default min-h-svh (which would push the layout past the window).
        className="min-h-0 flex-1"
        style={
          {
            minHeight: 0,
            '--sidebar-width': `${sidebarWidth}px`,
          } as React.CSSProperties
        }
      >
        <FileFinder />
        <ContentSearch />
        <FileCommands />
        <FilePromptDialog />
        <ProjectPickerDialog />
        <NewTaskDialog />
        <SettingsDialog />
        <AppSidebar />
        <RepoShell />
      </SidebarProvider>
      <Toaster />
    </div>
  )
}
