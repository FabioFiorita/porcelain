import { Button } from '@renderer/components/ui/button'
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuShortcut,
  ContextMenuTrigger,
} from '@renderer/components/ui/context-menu'
import { Kbd } from '@renderer/components/ui/kbd'
import { ScrollArea } from '@renderer/components/ui/scroll-area'
import { Tooltip, TooltipContent, TooltipTrigger } from '@renderer/components/ui/tooltip'
import { useIsMobile } from '@renderer/hooks/use-mobile'
import { kbdLabel } from '@renderer/lib/keyboard'
import { cn } from '@renderer/lib/utils'
import { type Tab, useTabsStore } from '@renderer/stores/tabs'
import { Pin, X } from 'lucide-react'
import { useEffect, useRef } from 'react'

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
  const closeUnpinnedTabs = useTabsStore((s) => s.closeUnpinnedTabs)
  const closeAllTabs = useTabsStore((s) => s.closeAllTabs)
  const pinTab = useTabsStore((s) => s.pinTab)
  const togglePinned = useTabsStore((s) => s.togglePinned)
  const openTabToSide = useTabsStore((s) => s.openTabToSide)
  // Split panes are unusable at phone width — hide the entry point there (the store
  // stays pane-capable). useIsMobile: the top bar isn't inside the sidebar context.
  const isMobile = useIsMobile()
  const isFirst = tabs[0]?.id === tab.id
  const isActive = tab.id === activeTabId
  const hasUnpinned = tabs.some((t) => !t.pinned)
  const ref = useRef<HTMLDivElement>(null)

  // Scroll the active tab into view whenever it becomes active — including a tab
  // appended past the capsule's right edge (the overflow repro that read as a
  // one-letter title). inline:'nearest' keeps it horizontal-only inside the
  // ScrollArea viewport; block:'nearest' avoids scrolling any ancestor vertically.
  // Sticky-pinned tabs live outside the ScrollArea, so this is a no-op for them.
  useEffect(() => {
    if (isActive) ref.current?.scrollIntoView({ inline: 'nearest', block: 'nearest' })
  }, [isActive])

  return (
    <Tooltip>
      <ContextMenu>
        <ContextMenuTrigger
          render={
            <TooltipTrigger
              render={
                <div
                  ref={ref}
                  className={cn(
                    'app-no-drag group flex h-7 shrink-0 cursor-default items-center gap-1 rounded-md border border-transparent px-3 text-sm-minus transition-all',
                    'data-active:bg-background dark:data-active:border-input dark:data-active:bg-input/30',
                    isActive ? 'text-foreground' : 'text-muted-foreground',
                  )}
                  data-active={isActive}
                  data-pinned={tab.pinned ? 'true' : undefined}
                  onClick={() => activateTab(paneIndex, tab.id)}
                  onDoubleClick={() => pinTab(tab.id)}
                  onAuxClick={(e) => e.button === 1 && closeTab(paneIndex, tab.id)}
                  onKeyDown={(e) => e.key === 'Enter' && activateTab(paneIndex, tab.id)}
                  role="tab"
                  tabIndex={0}
                  aria-selected={isActive}
                >
                  {tab.pinned ? (
                    <Pin className="size-3 shrink-0 text-muted-foreground" aria-hidden />
                  ) : null}
                  {/* File/diff tab titles are file names → mono (matching the tree + file
                      header); Review/Board/Terminal/etc. carry labels → sans.
                      pr-0.5 on the italic case: truncate's overflow:hidden would otherwise
                      shear the slanted top-right overhang of the last glyph (e.g. the x in .tsx). */}
                  <span
                    className={cn(
                      'max-w-40 truncate',
                      (tab.kind === 'file' || tab.kind === 'diff') && 'font-mono',
                      tab.preview && 'italic pr-0.5',
                    )}
                  >
                    {tab.title}
                  </span>
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    // Hover-revealed on pointer devices; always visible where hover doesn't
                    // exist (touch — iPad Safari), so the close button stays tappable there.
                    className="size-5 opacity-0 group-hover:opacity-100 [@media(hover:none)]:opacity-100"
                    onClick={(e) => {
                      e.stopPropagation()
                      closeTab(paneIndex, tab.id)
                    }}
                    aria-label={`Close ${tab.title}`}
                  >
                    <X />
                  </Button>
                </div>
              }
            />
          }
        />
        <ContextMenuContent>
          <ContextMenuItem onClick={() => togglePinned(paneIndex, tab.id)}>
            {tab.pinned ? 'Unpin Tab' : 'Pin Tab'}
          </ContextMenuItem>
          <ContextMenuSeparator />
          <ContextMenuItem onClick={() => closeTab(paneIndex, tab.id)}>
            Close
            <ContextMenuShortcut>
              <Kbd>{kbdLabel('mod', 'W')}</Kbd>
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
          <ContextMenuItem disabled={!hasUnpinned} onClick={() => closeUnpinnedTabs(paneIndex)}>
            Close Unpinned
          </ContextMenuItem>
          <ContextMenuItem onClick={closeAllTabs}>Close All</ContextMenuItem>
          {!isMobile && (
            <>
              <ContextMenuSeparator />
              <ContextMenuItem onClick={() => openTabToSide({ ...tab, preview: false })}>
                Open to the Side
                <ContextMenuShortcut>
                  <Kbd>{kbdLabel('mod', 'shift', 'S')}</Kbd>
                </ContextMenuShortcut>
              </ContextMenuItem>
            </>
          )}
        </ContextMenuContent>
      </ContextMenu>
      <TooltipContent side="bottom">{tab.title}</TooltipContent>
    </Tooltip>
  )
}

export function TabBar({ paneIndex }: { paneIndex: number }): React.JSX.Element {
  const tabs = useTabsStore((s) => s.panes[paneIndex]?.tabs ?? [])
  const pinned = tabs.filter((t) => t.pinned)
  const unpinned = tabs.filter((t) => !t.pinned)
  // isLast for close-to-right: last in the full ordered list (pinned then unpinned).
  const lastId = tabs[tabs.length - 1]?.id

  return (
    <div className="flex min-w-0 flex-1 items-center self-stretch gap-1">
      {pinned.length > 0 ? (
        <div className="flex shrink-0 items-center gap-1" role="presentation">
          {pinned.map((tab) => (
            <TabItem key={tab.id} tab={tab} paneIndex={paneIndex} isLast={tab.id === lastId} />
          ))}
        </div>
      ) : null}
      <ScrollArea orientation="horizontal" className="min-w-0 flex-1 self-stretch">
        <div className="flex h-full items-center gap-1">
          {unpinned.map((tab) => (
            <TabItem key={tab.id} tab={tab} paneIndex={paneIndex} isLast={tab.id === lastId} />
          ))}
        </div>
      </ScrollArea>
    </div>
  )
}
