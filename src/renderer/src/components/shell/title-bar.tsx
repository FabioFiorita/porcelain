import { Kbd } from '@renderer/components/ui/kbd'
import { kbdLabel } from '@renderer/lib/keyboard'
import { isBrowser, isLinuxShell } from '@renderer/lib/platform'
import { cn } from '@renderer/lib/utils'
import { useFileFinderStore } from '@renderer/stores/file-finder'
import { Search } from 'lucide-react'
import { EnvironmentSwitcher } from './environment-switcher'
import { WindowControls } from './window-controls'

/**
 * Full-width window titlebar. The macOS traffic lights own the left inset; a
 * centered search bar raises the Cmd+P file finder — it's just a clickable handle
 * on the same popup, not a separate command palette. (The rail avatar is the one
 * project-switcher trigger — a titlebar repo-identity anchor was tried and removed
 * as a duplicate.) Browser clients (iPad/iPhone
 * Safari) have no traffic lights, so the side spacers are dropped there — on a
 * phone they were eating ~128px of an already-tight bar. The Linux/Windows shell is
 * frameless (no native traffic lights either), so the left spacer is likewise
 * dropped and a custom WindowControls cluster sits at the right edge.
 *
 * The top-right carries the `EnvironmentSwitcher` — ALWAYS, local or remote, since a
 * control that only appears once you're remote can't be how you go remote (this
 * replaced a Remote-only chip). It owns the machine identity, the reachability dots,
 * and the version-skew warning (the second surface of that guard; the first is the
 * DaemonSkewToast).
 *
 * No border-b: the floating tiles sit flush under this bar (top: 3rem, paddingTop: 0),
 * and their own top edges already seat the chrome. A hairline here stacked on the
 * tile borders as a double line under the search field.
 */
export function TitleBar(): React.JSX.Element {
  const setFinderOpen = useFileFinderStore((s) => s.setOpen)

  return (
    <div className="app-drag flex h-12 shrink-0 items-center px-3">
      {!isBrowser && !isLinuxShell && <div className="w-16 shrink-0" aria-hidden />}
      <div className="flex flex-1 justify-center">
        <button
          type="button"
          onClick={() => setFinderOpen(true)}
          aria-label="Search files, folders, commands, commits"
          className="app-no-drag flex h-8 w-full max-w-[440px] items-center gap-2 rounded-lg border border-border/60 bg-muted px-3 text-xs text-muted-foreground transition-colors hover:border-ring/40 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
        >
          <Search className="size-3.5 shrink-0" />
          <span className="flex-1 truncate text-left">
            Search files, folders, commands, commits…
          </span>
          {/* Keyboard chords are noise on a phone soft-keyboard; keep them for pointer. */}
          <Kbd className="[@media(hover:none)]:hidden">{kbdLabel('mod', 'K')}</Kbd>
        </button>
      </div>
      {/* The switcher is always present, so this inset no longer collapses back to a
          bare traffic-light mirror; Linux/Windows widen further for the window controls. */}
      <div
        className={cn(
          'app-no-drag flex shrink-0 items-center justify-end gap-1',
          isLinuxShell ? 'min-w-24 pl-2' : 'min-w-16 pl-2',
        )}
      >
        <EnvironmentSwitcher />
        {isLinuxShell && <WindowControls />}
      </div>
    </div>
  )
}
