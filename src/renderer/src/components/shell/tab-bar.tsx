import { Button } from '@renderer/components/ui/button'
import { cn } from '@renderer/lib/utils'
import { useTabsStore } from '@renderer/stores/tabs'
import { X } from 'lucide-react'

export function TabBar(): React.JSX.Element {
  const tabs = useTabsStore((s) => s.tabs)
  const activeTabId = useTabsStore((s) => s.activeTabId)
  const activateTab = useTabsStore((s) => s.activateTab)
  const closeTab = useTabsStore((s) => s.closeTab)

  return (
    <div className="flex h-9 min-w-0 flex-1 items-end gap-px overflow-x-auto">
      {tabs.map((tab) => (
        <div
          key={tab.id}
          className={cn(
            'group flex h-8 shrink-0 cursor-default items-center gap-1 rounded-t-md px-3 text-sm',
            tab.id === activeTabId
              ? 'bg-background text-foreground'
              : 'text-muted-foreground hover:bg-muted/50',
          )}
          onClick={() => activateTab(tab.id)}
          onKeyDown={(e) => e.key === 'Enter' && activateTab(tab.id)}
          role="tab"
          tabIndex={0}
          aria-selected={tab.id === activeTabId}
        >
          <span className="truncate">{tab.title}</span>
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
      ))}
    </div>
  )
}
