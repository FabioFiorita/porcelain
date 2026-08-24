import { Button } from '@renderer/components/ui/button'
import { Popover, PopoverContent, PopoverTrigger } from '@renderer/components/ui/popover'
import { useSidebar } from '@renderer/components/ui/sidebar'
import { ActionsGroup, useActionRunStore } from '@renderer/features/actions'
import { toastUserActionError } from '@renderer/hooks/mutation-error'
import { isModExclusive, isTextEntry, kbdLabel } from '@renderer/lib/keyboard'
import { isMacShell } from '@renderer/lib/platform'
import { toggleTerminalPanel } from '@renderer/lib/terminal-actions'
import { cn } from '@renderer/lib/utils'
import { useTabsStore } from '@renderer/stores/tabs'
import { useTerminalsStore } from '@renderer/stores/terminals'
import { runUserAction } from '@shared/background'
import { TestIds } from '@shared/test-ids'
import { PanelBottom, PanelLeft, PanelRight, Zap } from 'lucide-react'
import { useEffect } from 'react'
import { MAC_TRAFFIC_LIGHT_CLEARANCE } from './shell-chrome'
import { ShortcutTooltip } from './shortcut-tooltip'
import { TabBar } from './tab-bar'
import { useViewerBreadcrumb } from './use-viewer-breadcrumb'

interface LeftSidebarHandle {
  collapsed: boolean
  toggle: () => void
}

/**
 * Saved Actions, in the header corner and reachable from any tab.
 *
 * They run in the selected Worktree wherever they are started from, so the roster does not
 * belong to one surface: a popover leaves whatever you were reading on screen, and running
 * one still opens the bottom panel onto its shell.
 */
function ActionsMenu(): React.JSX.Element {
  // Store-owned, not local state: the file finder opens this popover too, to hand back a
  // run that needs the trust step or a This-device folder.
  const open = useActionRunStore((s) => s.menuOpen)
  const setOpen = useActionRunStore((s) => s.setMenuOpen)

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent): void => {
      if (
        !isModExclusive(event) ||
        event.altKey ||
        !event.shiftKey ||
        event.key.toLowerCase() !== 'a' ||
        isTextEntry(event.target)
      ) {
        return
      }
      event.preventDefault()
      setOpen(true)
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [setOpen])

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <ShortcutTooltip label="Actions" shortcut={kbdLabel('mod', 'shift', 'A')}>
        <PopoverTrigger
          render={
            <Button
              variant="ghost"
              size="sm"
              className="h-7 gap-1 px-2 text-2xs text-muted-foreground"
              data-testid={TestIds.actionsMenu}
            >
              <Zap className="size-3.5" />
              Actions
            </Button>
          }
        />
      </ShortcutTooltip>
      <PopoverContent
        align="end"
        className="max-h-[calc(100dvh-4.5rem)] w-[min(24rem,calc(100vw-1rem))] overflow-auto p-1"
      >
        <ActionsGroup />
      </PopoverContent>
    </Popover>
  )
}

/** Header chrome for the center Viewer; feature internals stay below this boundary. */
export function ViewerHeader({ left }: { left: LeftSidebarHandle }): React.JSX.Element {
  const { toggleSidebar: toggleRight, isMobile, openMobile, open: rightOpen } = useSidebar()
  const crumbs = useViewerBreadcrumb()
  const paneCount = useTabsStore((s) => s.panes.length)
  const activePaneIndex = useTabsStore((s) => s.activePaneIndex)
  const panelOpen = useTerminalsStore((s) => s.panelOpen)
  const rightActive = isMobile ? openMobile : rightOpen
  const handleToggleRight = (): void => {
    toggleRight()
  }

  return (
    <div
      className={cn(
        'app-drag flex h-12 shrink-0 items-center gap-1 border-b pr-2',
        // When the left sidebar collapses, this header inherits the window's top-left
        // corner — and on macOS the native traffic lights are painted there regardless
        // (trafficLightPosition x:19, spanning to roughly x:70; see window.ts). At the
        // default `pl-2` the toggle button below lands at x≈17-45, directly underneath
        // them: the one control that reopens the sidebar, covered by the close button.
        // Same clearance app-sidebar.tsx reserves while it owns that corner.
        isMacShell && left.collapsed ? MAC_TRAFFIC_LIGHT_CLEARANCE : 'pl-2',
      )}
    >
      <ShortcutTooltip label="Toggle projects sidebar" shortcut={kbdLabel('mod', 'B')}>
        <Button
          variant="ghost"
          size="icon-sm"
          onClick={left.toggle}
          aria-label="Toggle projects sidebar"
          aria-expanded={!left.collapsed}
          data-testid={TestIds.toggleLeftSidebar}
          className="app-no-drag shrink-0"
        >
          <PanelLeft />
        </Button>
      </ShortcutTooltip>
      <div className="app-no-drag flex min-w-0 flex-1 items-center">
        {paneCount === 1 ? (
          <TabBar paneIndex={activePaneIndex} reserveScrollbarSpace />
        ) : crumbs.length === 0 ? (
          <span className="px-1 text-xs text-muted-foreground">Home</span>
        ) : (
          <div className="flex min-w-0 items-center gap-1 truncate px-1 text-xs">
            {crumbs.map((crumb, index) => (
              <span key={crumb.id} className="flex min-w-0 items-center gap-1">
                {index > 0 && <span className="text-muted-foreground">/</span>}
                <span
                  className={cn(
                    'truncate',
                    index === crumbs.length - 1 && 'font-medium text-foreground',
                  )}
                >
                  {crumb.label}
                </span>
              </span>
            ))}
          </div>
        )}
      </div>
      <div className="app-no-drag flex shrink-0 items-center gap-1">
        <ActionsMenu />
        <ShortcutTooltip label="Toggle terminal panel" shortcut={kbdLabel('mod', 'J')}>
          <Button
            variant="ghost"
            size="icon-sm"
            onClick={() =>
              runUserAction(
                () => toggleTerminalPanel(),
                (error) => toastUserActionError('Open terminal', error),
              )
            }
            aria-label="Toggle terminal panel"
            aria-expanded={panelOpen}
            data-testid={TestIds.toggleTerminalPanel}
          >
            <PanelBottom />
          </Button>
        </ShortcutTooltip>
        <ShortcutTooltip label="Toggle surfaces sidebar" shortcut={kbdLabel('mod', '.')}>
          <Button
            variant="ghost"
            size="icon-sm"
            onClick={handleToggleRight}
            aria-label="Toggle surfaces sidebar"
            aria-expanded={rightActive}
            data-testid={TestIds.toggleRightSidebar}
          >
            <PanelRight />
          </Button>
        </ShortcutTooltip>
      </div>
    </div>
  )
}
