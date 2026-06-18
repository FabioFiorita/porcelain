import { Kbd } from '@renderer/components/ui/kbd'
import { useFileFinderStore } from '@renderer/stores/file-finder'
import { Search } from 'lucide-react'

// Full-width window titlebar. The macOS traffic lights own the left inset, and a
// centered search bar raises the Cmd+P file finder — it's just a clickable handle
// on the same popup, not a separate command palette.
export function TitleBar(): React.JSX.Element {
  const setFinderOpen = useFileFinderStore((s) => s.setOpen)

  return (
    <div className="app-drag flex h-12 shrink-0 items-center border-b border-border/70 px-3">
      {/* Spacer matching the traffic lights so the bar centers against the window. */}
      <div className="w-16 shrink-0" />
      <div className="flex flex-1 justify-center">
        <button
          type="button"
          onClick={() => setFinderOpen(true)}
          aria-label="Search files, folders, commands"
          className="app-no-drag flex h-8 w-full max-w-[440px] items-center gap-2 rounded-lg border bg-black/20 px-3 text-xs text-muted-foreground transition-colors hover:border-ring/40 hover:text-foreground"
        >
          <Search className="size-3.5 shrink-0" />
          <span className="flex-1 truncate text-left">Search files, folders, commands…</span>
          <Kbd>⌘K</Kbd>
        </button>
      </div>
      <div className="w-16 shrink-0" />
    </div>
  )
}
