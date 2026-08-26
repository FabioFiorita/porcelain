import { Button } from '@renderer/components/ui/button'
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuTrigger,
} from '@renderer/components/ui/context-menu'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@renderer/components/ui/dropdown-menu'
import { Shortcut } from '@renderer/components/ui/kbd'
import { Sidebar, SidebarContent, SidebarHeader, useSidebar } from '@renderer/components/ui/sidebar'
import { isFramelessShell } from '@renderer/lib/platform'
import { cn } from '@renderer/lib/utils'
import { type SidebarTab, usePreferencesStore } from '@renderer/stores/preferences'
import {
  closeOtherSurfaces,
  closeSurfacesToLeft,
  closeSurfacesToRight,
  moveSurface,
  useSurfaceSessionStore,
} from '@renderer/stores/surface-session'
import { TestIds } from '@shared/test-ids'
import { Plus, X } from 'lucide-react'
import { useEffect, useRef } from 'react'
import { sidebarTopOffsetClass } from './shell-chrome'
import { ShortcutTooltip } from './shortcut-tooltip'
import { SidebarHeaderActionsProvider } from './sidebar-header-actions'
import { RightSidebarResizeHandle } from './sidebar-resize-handle'
import { SURFACES, SurfaceContent, SurfaceLauncher, surfaceDefinition } from './surface-sidebar'

export function SurfaceTabs({
  openTabs,
  activeTab,
  onActivate,
  onClose,
  onOpen,
  onReplaceTabs,
}: {
  openTabs: SidebarTab[]
  activeTab: SidebarTab
  onActivate: (id: SidebarTab) => void
  onClose: (id: SidebarTab) => void
  onOpen: (id: SidebarTab) => void
  onReplaceTabs: (tabs: SidebarTab[], activate?: SidebarTab) => void
}): React.JSX.Element {
  const available = SURFACES.filter((surface) => !openTabs.includes(surface.id))
  const lastId = openTabs[openTabs.length - 1]

  return (
    <div data-testid={TestIds.rail} className="flex min-w-0 flex-1 items-center gap-1">
      <div className="flex min-w-0 flex-1 items-center gap-1 overflow-x-auto">
        {openTabs.map((id, index) => {
          const surface = surfaceDefinition(id)
          const Icon = surface.icon
          const active = activeTab === id
          return (
            <ContextMenu key={id}>
              <ContextMenuTrigger
                render={
                  <div
                    role="tab"
                    tabIndex={0}
                    aria-selected={active}
                    draggable
                    onDragStart={(event: React.DragEvent<HTMLDivElement>) => {
                      event.dataTransfer.effectAllowed = 'move'
                      event.dataTransfer.setData('text/plain', id)
                    }}
                    onDragOver={(event: React.DragEvent<HTMLDivElement>) => {
                      event.preventDefault()
                      event.dataTransfer.dropEffect = 'move'
                    }}
                    onDrop={(event: React.DragEvent<HTMLDivElement>) => {
                      event.preventDefault()
                      const from = event.dataTransfer.getData('text/plain')
                      if (from === '' || from === id) return
                      onReplaceTabs(moveSurface(openTabs, from as SidebarTab, id))
                    }}
                    onAuxClick={(event: React.MouseEvent<HTMLDivElement>) => {
                      if (event.button === 1) onClose(id)
                    }}
                    className={cn(
                      'app-no-drag group flex h-7 shrink-0 items-center gap-1 rounded-md pr-1 pl-2 text-xs',
                      active
                        ? 'bg-accent text-accent-foreground'
                        : 'text-muted-foreground hover:bg-accent/40',
                    )}
                  >
                    <ShortcutTooltip
                      label={`Open ${surface.label}`}
                      tokens={['mod', surface.shortcut]}
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
                }
              />
              <ContextMenuContent>
                <ContextMenuItem
                  data-testid={TestIds.railTabMenu('close')}
                  onClick={() => onClose(id)}
                >
                  Close
                </ContextMenuItem>
                <ContextMenuItem
                  data-testid={TestIds.railTabMenu('close-others')}
                  disabled={openTabs.length < 2}
                  onClick={() => onReplaceTabs(closeOtherSurfaces(openTabs, id), id)}
                >
                  Close Others
                </ContextMenuItem>
                <ContextMenuItem
                  data-testid={TestIds.railTabMenu('close-left')}
                  disabled={index === 0}
                  onClick={() => onReplaceTabs(closeSurfacesToLeft(openTabs, id))}
                >
                  Close to the Left
                </ContextMenuItem>
                <ContextMenuItem
                  data-testid={TestIds.railTabMenu('close-right')}
                  disabled={id === lastId}
                  onClick={() => onReplaceTabs(closeSurfacesToRight(openTabs, id))}
                >
                  Close to the Right
                </ContextMenuItem>
                <ContextMenuSeparator />
                <ContextMenuItem
                  data-testid={TestIds.railTabMenu('close-all')}
                  onClick={() => onReplaceTabs([])}
                >
                  Close All
                </ContextMenuItem>
              </ContextMenuContent>
            </ContextMenu>
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
            <DropdownMenuContent align="end" className="w-44">
              <DropdownMenuGroup>
                {available.map((surface) => {
                  const Icon = surface.icon
                  return (
                    <DropdownMenuItem key={surface.id} onClick={() => onOpen(surface.id)}>
                      <Icon />
                      {surface.label}
                      <Shortcut className="ml-auto shrink-0" tokens={['mod', surface.shortcut]} />
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
  const openTabs = useSurfaceSessionStore((s) => s.openTabs)
  const setOpenTabs = useSurfaceSessionStore((s) => s.setOpenTabs)
  const previousTab = useRef<SidebarTab | null>(null)

  // Programmatic handoffs (for example Changes → Files after opening a file) should
  // add the destination surface to the strip without making the initial launcher
  // open a default tab from persisted preference state.
  useEffect(() => {
    const previous = previousTab.current
    previousTab.current = sidebarTab
    if (previous === null) return
    setOpenTabs((current) => (current.includes(sidebarTab) ? current : [...current, sidebarTab]))
  }, [sidebarTab, setOpenTabs])

  const openSurface = (id: SidebarTab): void => {
    setOpenTabs((current) => (current.includes(id) ? current : [...current, id]))
    setSidebarTab(id)
  }

  const closeSurface = (id: SidebarTab): void => {
    replaceTabs(openTabs.filter((surface) => surface !== id))
  }

  const replaceTabs = (next: SidebarTab[], activate?: SidebarTab): void => {
    setOpenTabs(next)
    if (activate !== undefined && next.includes(activate)) {
      setSidebarTab(activate)
      return
    }
    if (next.includes(sidebarTab)) return
    const replacement = next.at(-1)
    if (replacement !== undefined) setSidebarTab(replacement)
  }

  const hasOpenTabs = openTabs.length > 0
  const activeTab = openTabs.includes(sidebarTab) ? sidebarTab : (openTabs[0] ?? null)

  return (
    <Sidebar
      side="right"
      variant="floating"
      collapsible="offcanvas"
      data-testid={TestIds.rightSidebar}
      className={cn(
        'md:pt-[9px] md:pb-[9px]',
        // Same offset the left sidebar takes — shared so the two cannot drift apart again.
        sidebarTopOffsetClass(isFramelessShell),
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
            onReplaceTabs={replaceTabs}
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
      <SidebarHeaderActionsProvider value={null}>
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
