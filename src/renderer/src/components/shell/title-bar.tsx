import { Kbd } from '@renderer/components/ui/kbd'
import { kbdLabel } from '@renderer/lib/keyboard'
import { useFileFinderStore } from '@renderer/stores/file-finder'
import { Search } from 'lucide-react'
import { WindowControls } from './window-controls'

// Full-width window titlebar. On macOS the traffic lights own the left inset and a
// centered search bar raises the Cmd+P file finder. On Linux/Windows there are no OS
// traffic lights, so we render our own WindowControls on the right and balance them
// with a matching left spacer so the search stays centered. The search bar is just a
// clickable handle on the finder popup, not a separate command palette.
export function TitleBar(): React.JSX.Element {
  const setFinderOpen = useFileFinderStore((s) => s.setOpen)
  const isMac = window.porcelain.platform === 'darwin'

  return (
    <div className="app-drag flex h-12 shrink-0 items-center px-3">
      {/* Left inset: traffic lights on macOS, else a spacer matching the controls cluster. */}
      <div className={isMac ? 'w-16 shrink-0' : 'w-[100px] shrink-0'} />
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
          <Kbd>{kbdLabel('mod', 'K')}</Kbd>
        </button>
      </div>
      {isMac ? <div className="w-16 shrink-0" /> : <WindowControls />}
    </div>
  )
}
