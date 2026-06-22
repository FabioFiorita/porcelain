import { Button } from '@renderer/components/ui/button'
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuShortcut,
  ContextMenuTrigger,
} from '@renderer/components/ui/context-menu'
import { Kbd } from '@renderer/components/ui/kbd'
import { ScrollArea } from '@renderer/components/ui/scroll-area'
import { cn } from '@renderer/lib/utils'
import { type Tab, useTabsStore } from '@renderer/stores/tabs'
import { X } from 'lucide-react'

function TabItem({
  tab,
  paneIndex,
  isLast,
}: {
  tab: Tab
  paneIndex: number
  isLast: boolean
}): React.JSX.Element {
  const tabs = useTabsStore((s) => s.panes[paneIndex]?.tabs ?? [])
  const activeTabId = useTabsStore((s) => s.panes[paneIndex]?.activeTabId ?? null)
  const activateTab = useTabsStore((s) => s.activateTab)
  const closeTab = useTabsStore((s) => s.closeTab)
  const closeOtherTabs = useTabsStore((s) => s.closeOtherTabs)
  const closeTabsToLeft = useTabsStore((s) => s.closeTabsToLeft)
  const closeTabsToRight = useTabsStore((s) => s.closeTabsToRight)
  const closeAllTabs = useTabsStore((s) => s.closeAllTabs)
  const pinTab = useTabsStore((s) => s.pinTab)
  const openTabToSide = useTabsStore((s) => s.openTabToSide)
  const isFirst = tabs[0]?.id === tab.id

  return (
    <ContextMenu>
      <ContextMenuTrigger>
        <div
          className={cn(
            'glaze-segment app-no-drag group flex h-7 shrink-0 cursor-default items-center gap-1 rounded-md px-3 text-sm-minus',
            tab.id === activeTabId ? 'text-foreground' : 'text-muted-foreground',
          )}
          data-active={tab.id === activeTabId}
          onClick={() => activateTab(paneIndex, tab.id)}
          onDoubleClick={() => pinTab(tab.id)}
          onAuxClick={(e) => e.button === 1 && closeTab(paneIndex, tab.id)}
          onKeyDown={(e) => e.key === 'Enter' && activateTab(paneIndex, tab.id)}
          role="tab"
          tabIndex={0}
          aria-selected={tab.id === activeTabId}
        >
          {/* pr-0.5 on the italic case: truncate's overflow:hidden would otherwise
              shear the slanted top-right overhang of the last glyph (e.g. the x in .tsx). */}
          <span className={cn('max-w-40 truncate', tab.preview && 'italic pr-0.5')}>
            {tab.title}
          </span>
          <Button
            variant="ghost"
            size="icon-sm"
            className="size-5 opacity-0 group-hover:opacity-100"
            onClick={(e) => {
              e.stopPropagation()
              closeTab(paneIndex, tab.id)
            }}
            aria-label={`Close ${tab.title}`}
          >
            <X />
          </Button>
        </div>
      </ContextMenuTrigger>
      <ContextMenuContent>
        <ContextMenuItem onClick={() => closeTab(paneIndex, tab.id)}>
          Close
          <ContextMenuShortcut>
            <Kbd>⌘W</Kbd>
          </ContextMenuShortcut>
        </ContextMenuItem>
        <ContextMenuItem
          disabled={tabs.length < 2}
          onClick={() => closeOtherTabs(paneIndex, tab.id)}
        >
          Close Others
        </ContextMenuItem>
        <ContextMenuItem disabled={isFirst} onClick={() => closeTabsToLeft(paneIndex, tab.id)}>
          Close to the Left
        </ContextMenuItem>
        <ContextMenuItem disabled={isLast} onClick={() => closeTabsToRight(paneIndex, tab.id)}>
          Close to the Right
        </ContextMenuItem>
        <ContextMenuItem onClick={closeAllTabs}>Close All</ContextMenuItem>
        <ContextMenuItem onClick={() => openTabToSide({ ...tab, preview: false })}>
          Open to the Side
          <ContextMenuShortcut>
            <Kbd>⌘⇧S</Kbd>
          </ContextMenuShortcut>
        </ContextMenuItem>
      </ContextMenuContent>
    </ContextMenu>
  )
}

export function TabBar({ paneIndex }: { paneIndex: number }): React.JSX.Element {
  const tabs = useTabsStore((s) => s.panes[paneIndex]?.tabs ?? [])

  return (
    <ScrollArea orientation="horizontal" className="min-w-0 flex-1 self-stretch">
      <div className="flex h-full items-center gap-1">
        {tabs.map((tab, index) => (
          <TabItem
            key={tab.id}
            tab={tab}
            paneIndex={paneIndex}
            isLast={index === tabs.length - 1}
          />
        ))}
      </div>
    </ScrollArea>
  )
}
