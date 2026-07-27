import { Kbd } from '@renderer/components/ui/kbd'
import { kbdLabel } from '@renderer/lib/keyboard'
import { isBrowser, isLinuxShell } from '@renderer/lib/platform'
import { cn } from '@renderer/lib/utils'
import { useFileFinderStore } from '@renderer/stores/file-finder'
import { Search } from 'lucide-react'
import { EnvironmentSwitcher } from './environment-switcher'
import { UpdateButton } from './update-button'
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
 * Search is **absolutely centered** in the full bar (not in the leftover flex
 * space). The environment chip / window controls sit on the right and must not
 * shove the search left — on a phone the named env chip alone was enough to make
 * the field look off-center.
 *
 * The top-right carries the `EnvironmentSwitcher` — ALWAYS, local or remote, since a
 * control that only appears once you're remote can't be how you go remote (this
 * replaced a Remote-only chip). It owns the machine identity, the reachability dots,
 * and the version-skew warning (the second surface of that guard; the first is the
 * DaemonSkewToast). When an update is downloaded, `UpdateButton` sits to its left as
 * a matching chip (same height/surface; icon-only on phone) — app-level chrome
 * belongs here, not in the viewer's document TopBar.
 *
 * No border-b: the floating tiles sit flush under this bar (top: 3rem, paddingTop: 0),
 * and their own top edges already seat the chrome. A hairline here stacked on the
 * tile borders as a double line under the search field.
 */
export function TitleBar(): React.JSX.Element {
  const setFinderOpen = useFileFinderStore((s) => s.setOpen)

  return (
    <div className="app-drag relative flex h-12 shrink-0 items-center px-3">
      {/* True window center — independent of asymmetric left/right chrome widths. */}
      <div className="pointer-events-none absolute inset-0 flex items-center justify-center px-14">
        <button
          type="button"
          onClick={() => setFinderOpen(true)}
          aria-label="Search files, folders, commands, commits"
          className="app-no-drag pointer-events-auto flex h-8 w-full max-w-[440px] items-center gap-2 rounded-lg border border-border/60 bg-muted px-3 text-xs text-muted-foreground transition-colors hover:border-ring/40 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
        >
          <Search className="size-3.5 shrink-0" />
          <span className="min-w-0 flex-1 truncate text-left">
            Search files, folders, commands, commits…
          </span>
          {/* Keyboard chords are noise on a phone soft-keyboard; keep them for pointer. */}
          <Kbd className="[@media(hover:none)]:hidden">{kbdLabel('mod', 'K')}</Kbd>
        </button>
      </div>

      {!isBrowser && !isLinuxShell && <div className="w-16 shrink-0" aria-hidden />}
      {/* Spacer so the absolute search isn't the only flex child; keeps height/layout. */}
      <div className="min-w-0 flex-1" aria-hidden />
      <div
        className={cn(
          'app-no-drag relative z-10 flex shrink-0 items-center justify-end gap-1.5',
          isLinuxShell ? 'min-w-24 pl-2' : 'min-w-16 pl-2',
        )}
      >
        <UpdateButton />
        <EnvironmentSwitcher />
        {isLinuxShell && <WindowControls />}
      </div>
    </div>
  )
}
