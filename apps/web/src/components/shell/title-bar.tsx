import { Kbd } from '@renderer/components/ui/kbd'
import { useIsMobile } from '@renderer/hooks/use-mobile'
import { kbdLabel } from '@renderer/lib/keyboard'
import { isBrowser, isLinuxShell } from '@renderer/lib/platform'
import { cn } from '@renderer/lib/utils'
import { useFileFinderStore } from '@renderer/stores/file-finder'
import { Search } from 'lucide-react'
import { EnvironmentSwitcher } from './environment-switcher'
import { UpdateButton } from './update-button'
import { WindowControls } from './window-controls'

/**
 * Full-width window titlebar. Search bar is a clickable handle on the Cmd+P file
 * finder popup, not a separate command palette; the rail avatar is the one
 * project-switcher trigger (a titlebar repo-identity anchor was tried and removed
 * as a duplicate). Browser clients (no traffic lights) drop the side spacers — on
 * a phone they ate ~128px of an already-tight bar. The frameless Linux/Windows
 * shell likewise drops the left spacer, with WindowControls at the right edge.
 *
 * Search sits absolutely centered in the FULL bar, not the leftover flex space —
 * the env chip / window controls must not shove it left.
 *
 * `EnvironmentSwitcher` shows ALWAYS (local or remote): a control that only
 * appears once you're remote can't be how you go remote. It owns machine
 * identity and reachability. `UpdateButton` sits to its left once a download is ready.
 *
 * No border-b: floating tiles seat their own top chrome under this bar; a
 * hairline here doubled up as a second line under the search field.
 */
export function TitleBar(): React.JSX.Element {
  const setFinderOpen = useFileFinderStore((s) => s.setOpen)
  // Search must sit level with the chips beside it, and they size differently per
  // breakpoint: on desktop both derive 26px from a text-xs line box + py-1, on a
  // phone both chips collapse to size-8 squares. Matching 26px there too would
  // shrink a tap target to fix an alignment nobody has — so the phone stays at 32.
  const compact = useIsMobile()

  return (
    <div className="app-drag relative flex h-12 shrink-0 items-center px-3">
      {/* True window center — independent of asymmetric left/right chrome widths. */}
      <div className="pointer-events-none absolute inset-0 flex items-center justify-center px-14">
        <button
          type="button"
          onClick={() => setFinderOpen(true)}
          aria-label="Search files, folders, commands, commits"
          className={cn(
            'app-no-drag pointer-events-auto flex w-full max-w-[440px] items-center gap-2',
            'rounded-lg border border-border/60 bg-muted px-3 text-xs text-muted-foreground',
            'transition-colors hover:border-ring/40 hover:text-foreground',
            'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50',
            compact ? 'h-8' : 'py-1',
          )}
        >
          <Search className="size-3.5 shrink-0" />
          <span className="min-w-0 flex-1 truncate text-left">
            Search files, folders, commands, commits…
          </span>
          {/* Keyboard chords are noise on a phone soft-keyboard; keep them for pointer.
              h-4 caps the chord at the text line box: Kbd's default h-5 is the tallest
              child here, and it would push the field to 30px — 4px off the chips. */}
          <Kbd className="h-4 [@media(hover:none)]:hidden">{kbdLabel('mod', 'K')}</Kbd>
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
