import { Button } from '@renderer/components/ui/button'
import { useSidebar } from '@renderer/components/ui/sidebar'
import { kbdLabel } from '@renderer/lib/keyboard'
import { isMacShell } from '@renderer/lib/platform'
import { cn } from '@renderer/lib/utils'
import { useTabsStore } from '@renderer/stores/tabs'
import { TestIds } from '@shared/test-ids'
import { PanelLeft, PanelRight } from 'lucide-react'
import { MAC_TRAFFIC_LIGHT_CLEARANCE } from './shell-chrome'
import { ShortcutTooltip } from './shortcut-tooltip'
import { TabBar } from './tab-bar'
import { useViewerBreadcrumb } from './use-viewer-breadcrumb'

interface LeftSidebarHandle {
  collapsed: boolean
  toggle: () => void
}

/** Header chrome for the center Viewer; feature internals stay below this boundary. */
export function ViewerHeader({ left }: { left: LeftSidebarHandle }): React.JSX.Element {
  const { toggleSidebar: toggleRight, isMobile, openMobile, open: rightOpen } = useSidebar()
  const crumbs = useViewerBreadcrumb()
  const paneCount = useTabsStore((s) => s.panes.length)
  const activePaneIndex = useTabsStore((s) => s.activePaneIndex)
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
