import { Button } from '@renderer/components/ui/button'
import { SidebarGroup, SidebarGroupContent } from '@renderer/components/ui/sidebar'
import { useSearchStore } from '@renderer/stores/search'
import { Search, X } from 'lucide-react'

/** Recent Search-tab queries (the companion header names the section); clicking
 *  one re-runs it in the panel, the row's × drops it from the list. */
export function SearchQuickAccess(): React.JSX.Element {
  const recent = useSearchStore((s) => s.recent)
  const setQuery = useSearchStore((s) => s.setQuery)
  const forget = useSearchStore((s) => s.forget)

  return (
    <SidebarGroup className="px-3 pt-3">
      <SidebarGroupContent>
        {recent.length === 0 ? (
          <p className="px-1 py-1 text-xs text-muted-foreground">
            Your recent searches will appear here.
          </p>
        ) : (
          <div className="flex flex-col gap-0.5">
            {recent.map((query) => (
              <div
                key={query}
                className="group/recent flex h-7 items-center gap-1 rounded-md px-1 text-sm-minus hover:bg-accent"
              >
                <button
                  type="button"
                  onClick={() => setQuery(query)}
                  className="flex min-w-0 flex-1 items-center gap-2 text-left"
                >
                  <Search className="size-3.5 shrink-0 text-muted-foreground" />
                  <span className="min-w-0 truncate">{query}</span>
                </button>
                <Button
                  variant="ghost"
                  size="icon-sm"
                  className="size-5 shrink-0 opacity-0 group-hover/recent:opacity-100"
                  aria-label={`Remove “${query}” from recent searches`}
                  onClick={() => forget(query)}
                >
                  <X />
                </Button>
              </div>
            ))}
          </div>
        )}
      </SidebarGroupContent>
    </SidebarGroup>
  )
}
