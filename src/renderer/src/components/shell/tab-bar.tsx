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

function TabItem({ tab, isLast }: { tab: Tab; isLast: boolean }): React.JSX.Element {
  const tabs = useTabsStore((s) => s.tabs)
  const activeTabId = useTabsStore((s) => s.activeTabId)
  const activateTab = useTabsStore((s) => s.activateTab)
  const closeTab = useTabsStore((s) => s.closeTab)
  const closeOtherTabs = useTabsStore((s) => s.closeOtherTabs)
  const closeTabsToLeft = useTabsStore((s) => s.closeTabsToLeft)
  const closeTabsToRight = useTabsStore((s) => s.closeTabsToRight)
  const closeAllTabs = useTabsStore((s) => s.closeAllTabs)
  const pinTab = useTabsStore((s) => s.pinTab)
  const isFirst = tabs[0]?.id === tab.id

  return (
    <ContextMenu>
      <ContextMenuTrigger>
        <div
          className={cn(
            'app-no-drag group flex h-8 shrink-0 cursor-default items-center gap-1 rounded-t-md px-3 text-sm',
            tab.id === activeTabId
              ? 'bg-background text-foreground'
              : 'text-muted-foreground hover:bg-muted/50',
          )}
          onClick={() => activateTab(tab.id)}
          onDoubleClick={() => pinTab(tab.id)}
          onAuxClick={(e) => e.button === 1 && closeTab(tab.id)}
          onKeyDown={(e) => e.key === 'Enter' && activateTab(tab.id)}
          role="tab"
          tabIndex={0}
          aria-selected={tab.id === activeTabId}
        >
          <span className={cn('max-w-40 truncate', tab.preview && 'italic')}>{tab.title}</span>
          <Button
            variant="ghost"
            size="icon-sm"
            className="size-5 opacity-0 group-hover:opacity-100"
            onClick={(e) => {
              e.stopPropagation()
              closeTab(tab.id)
            }}
            aria-label={`Close ${tab.title}`}
          >
            <X />
          </Button>
        </div>
      </ContextMenuTrigger>
      <ContextMenuContent>
        <ContextMenuItem onClick={() => closeTab(tab.id)}>
          Close
          <ContextMenuShortcut>
            <Kbd>⌘W</Kbd>
          </ContextMenuShortcut>
        </ContextMenuItem>
        <ContextMenuItem disabled={tabs.length < 2} onClick={() => closeOtherTabs(tab.id)}>
          Close Others
        </ContextMenuItem>
        <ContextMenuItem disabled={isFirst} onClick={() => closeTabsToLeft(tab.id)}>
          Close to the Left
        </ContextMenuItem>
        <ContextMenuItem disabled={isLast} onClick={() => closeTabsToRight(tab.id)}>
          Close to the Right
        </ContextMenuItem>
        <ContextMenuItem onClick={closeAllTabs}>Close All</ContextMenuItem>
      </ContextMenuContent>
    </ContextMenu>
  )
}

export function TabBar(): React.JSX.Element {
  const tabs = useTabsStore((s) => s.tabs)

  return (
    <ScrollArea orientation="horizontal" className="min-w-0 flex-1 self-stretch">
      <div className="flex h-full items-end gap-px">
        {tabs.map((tab, index) => (
          <TabItem key={tab.id} tab={tab} isLast={index === tabs.length - 1} />
        ))}
      </div>
    </ScrollArea>
  )
}
