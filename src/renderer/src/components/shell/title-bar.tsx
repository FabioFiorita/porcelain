import { Kbd } from '@renderer/components/ui/kbd'
import { kbdLabel } from '@renderer/lib/keyboard'
import { isBrowser } from '@renderer/lib/platform'
import { useFileFinderStore } from '@renderer/stores/file-finder'
import { Search } from 'lucide-react'

// Full-width window titlebar. The macOS traffic lights own the left inset, and a
// centered search bar raises the Cmd+P file finder — it's just a clickable handle
// on the same popup, not a separate command palette. Browser clients (iPad/iPhone
// Safari) have no traffic lights, so the side spacers are dropped there — on a
// phone they were eating ~128px of an already-tight bar.
export function TitleBar(): React.JSX.Element {
  const setFinderOpen = useFileFinderStore((s) => s.setOpen)

  return (
    <div className="app-drag flex h-12 shrink-0 items-center px-3">
      {!isBrowser && <div className="w-16 shrink-0" aria-hidden />}
      <div className="flex flex-1 justify-center">
        <button
          type="button"
          onClick={() => setFinderOpen(true)}
          aria-label="Search files, folders, commands, commits"
          className="app-no-drag flex h-8 w-full max-w-[440px] items-center gap-2 rounded-lg border bg-black/20 px-3 text-xs text-muted-foreground transition-colors hover:border-ring/40 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
        >
          <Search className="size-3.5 shrink-0" />
          <span className="flex-1 truncate text-left">
            Search files, folders, commands, commits…
          </span>
          {/* Keyboard chords are noise on a phone soft-keyboard; keep them for pointer. */}
          <Kbd className="[@media(hover:none)]:hidden">{kbdLabel('mod', 'K')}</Kbd>
        </button>
      </div>
      {!isBrowser && <div className="w-16 shrink-0" aria-hidden />}
    </div>
  )
}
