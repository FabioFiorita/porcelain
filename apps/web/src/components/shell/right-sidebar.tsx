import { Button } from '@renderer/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@renderer/components/ui/dropdown-menu'
import { Kbd } from '@renderer/components/ui/kbd'
import { Sidebar, SidebarContent, SidebarHeader, useSidebar } from '@renderer/components/ui/sidebar'
import { kbdLabel } from '@renderer/lib/keyboard'
import { isBrowser } from '@renderer/lib/platform'
import { cn } from '@renderer/lib/utils'
import { type SidebarTab, usePreferencesStore } from '@renderer/stores/preferences'
import { TestIds } from '@shared/test-ids'
import { Plus, X } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { ShortcutTooltip } from './shortcut-tooltip'
import { SidebarHeaderActionsProvider } from './sidebar-header-actions'
import { RightSidebarResizeHandle } from './sidebar-resize-handle'
import { SURFACES, SurfaceContent, SurfaceLauncher, surfaceDefinition } from './surface-sidebar'

function SurfaceTabs({
  openTabs,
  activeTab,
  onActivate,
  onClose,
  onOpen,
}: {
  openTabs: SidebarTab[]
  activeTab: SidebarTab
  onActivate: (id: SidebarTab) => void
  onClose: (id: SidebarTab) => void
  onOpen: (id: SidebarTab) => void
}): React.JSX.Element {
  const available = SURFACES.filter((surface) => !openTabs.includes(surface.id))

  return (
    <div data-testid={TestIds.rail} className="flex min-w-0 flex-1 items-center gap-1">
      <div className="flex min-w-0 flex-1 items-center gap-1 overflow-x-auto">
        {openTabs.map((id) => {
          const surface = surfaceDefinition(id)
          const Icon = surface.icon
          const active = activeTab === id
          return (
            <div
              key={id}
              className={cn(
                'app-no-drag group flex h-7 shrink-0 items-center gap-1 rounded-md pr-1 pl-2 text-xs',
                active
                  ? 'bg-accent text-accent-foreground'
                  : 'text-muted-foreground hover:bg-accent/40',
              )}
            >
              <ShortcutTooltip
                label={`Open ${surface.label}`}
                shortcut={kbdLabel('mod', surface.shortcut)}
              >
                <button
                  type="button"
                  data-testid={TestIds.railTab(id)}
                  onClick={() => onActivate(id)}
                  className="flex min-w-0 items-center gap-1.5"
                >
                  <Icon className="size-3.5 shrink-0" />
                  <span className="truncate">{surface.label}</span>
                </button>
              </ShortcutTooltip>
              <Button
                variant="ghost"
                size="icon-xs"
                className="size-5 opacity-0 group-hover:opacity-100 [@media(hover:none)]:opacity-100"
                onClick={() => onClose(id)}
                aria-label={`Close ${surface.label}`}
              >
                <X />
              </Button>
            </div>
          )
        })}
      </div>
      {available.length > 0 && (
        <div className="app-no-drag shrink-0">
          <DropdownMenu>
            <DropdownMenuTrigger
              render={
                <Button variant="ghost" size="icon-sm" aria-label="Open a surface">
                  <Plus />
                </Button>
              }
            />
            <DropdownMenuContent align="end">
              <DropdownMenuGroup>
                {available.map((surface) => {
                  const Icon = surface.icon
                  return (
                    <DropdownMenuItem key={surface.id} onClick={() => onOpen(surface.id)}>
                      <Icon />
                      {surface.label}
                      <Kbd className="ml-auto">{kbdLabel('mod', surface.shortcut)}</Kbd>
                    </DropdownMenuItem>
                  )
                })}
              </DropdownMenuGroup>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      )}
    </div>
  )
}

/** The right shell owns only open surface chrome; every surface opens detail in the Viewer. */
export function RightSidebar(): React.JSX.Element {
  const sidebarTab = usePreferencesStore((s) => s.sidebarTab)
  const setSidebarTab = usePreferencesStore((s) => s.setSidebarTab)
  const { isMobile } = useSidebar()
  const [openTabs, setOpenTabs] = useState<SidebarTab[]>([])
  const [actionsSlot, setActionsSlot] = useState<HTMLElement | null>(null)
  const previousTab = useRef<SidebarTab | null>(null)

  // Programmatic handoffs (for example Changes → Files after opening a file) should
  // add the destination surface to the strip without making the initial launcher
  // open a default tab from persisted preference state.
  useEffect(() => {
    const previous = previousTab.current
    previousTab.current = sidebarTab
    if (previous === null) return
    setOpenTabs((current) => (current.includes(sidebarTab) ? current : [...current, sidebarTab]))
  }, [sidebarTab])

  const openSurface = (id: SidebarTab): void => {
    setOpenTabs((current) => (current.includes(id) ? current : [...current, id]))
    setSidebarTab(id)
  }

  const closeSurface = (id: SidebarTab): void => {
    const next = openTabs.filter((surface) => surface !== id)
    setOpenTabs(next)
    if (sidebarTab === id) {
      const replacement = next.at(-1)
      if (replacement !== undefined) setSidebarTab(replacement)
    }
  }

  const hasOpenTabs = openTabs.length > 0
  const activeTab = openTabs.includes(sidebarTab) ? sidebarTab : (openTabs[0] ?? null)
  // Surfaces that portal controls into the header action row. Board opens the wide board;
  // Tasks opens the daemon-wide table.
  const hasActionRow =
    hasOpenTabs && activeTab !== null && (activeTab === 'board' || activeTab === 'tasks')

  return (
    <Sidebar
      side="right"
      variant="floating"
      collapsible="offcanvas"
      data-testid={TestIds.rightSidebar}
      className={cn(
        'md:pt-[9px] md:pb-[9px]',
        isBrowser
          ? 'md:top-[env(safe-area-inset-top)] md:h-[calc(100dvh-env(safe-area-inset-top)-env(safe-area-inset-bottom))]'
          : 'md:top-[calc(3rem+env(safe-area-inset-top))] md:h-[calc(100dvh-3rem-env(safe-area-inset-top)-env(safe-area-inset-bottom))]',
      )}
    >
      {!isMobile && <RightSidebarResizeHandle />}
      <SidebarHeader className="app-drag h-12 shrink-0 flex-row items-center gap-1 border-b py-0 pr-2 pl-2">
        {hasOpenTabs && activeTab !== null ? (
          <SurfaceTabs
            openTabs={openTabs}
            activeTab={activeTab}
            onActivate={setSidebarTab}
            onClose={closeSurface}
            onOpen={openSurface}
          />
        ) : (
          <span
            data-testid={TestIds.sidebarPanelTitle}
            className="min-w-0 flex-1 truncate px-1 text-xs font-semibold text-foreground"
          >
            Surfaces
          </span>
        )}
      </SidebarHeader>
      {hasActionRow && (
        <div className="app-drag flex h-8 shrink-0 items-center justify-end border-b px-2">
          <div ref={setActionsSlot} className="app-no-drag flex shrink-0 items-center"></div>
        </div>
      )}
      <SidebarHeaderActionsProvider value={actionsSlot}>
        <SidebarContent
          data-testid={TestIds.sidebarPanel}
          className={cn(activeTab === 'files' && 'gap-0 overflow-hidden')}
        >
          {activeTab === null ? (
            <SurfaceLauncher options={SURFACES.map((surface) => surface.id)} onOpen={openSurface} />
          ) : (
            <SurfaceContent active={activeTab} openTabs={openTabs} />
          )}
        </SidebarContent>
      </SidebarHeaderActionsProvider>
    </Sidebar>
  )
}
