import { Kbd } from '@renderer/components/ui/kbd'
import { Tooltip, TooltipContent, TooltipTrigger } from '@renderer/components/ui/tooltip'
import { useDaemonSkew } from '@renderer/hooks/use-daemon-skew'
import { useActiveRemoteEnvironment } from '@renderer/hooks/use-remote-daemon'
import { kbdLabel } from '@renderer/lib/keyboard'
import { isBrowser, isLinuxShell } from '@renderer/lib/platform'
import { cn } from '@renderer/lib/utils'
import { useFileFinderStore } from '@renderer/stores/file-finder'
import { useSettingsDialogStore } from '@renderer/stores/settings-dialog'
import { Cloud, Search, TriangleAlert } from 'lucide-react'
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
 * When THIS window is bound to a remote daemon (Settings → Environments), a
 * Remote chip sits top-right (the environment name, cloud icon) so the human never
 * confuses a Beelink window with a local one. Click opens Environments. If the
 * daemon's build version differs from this app's, the chip gains an amber warning
 * and the tooltip explains the skew — the second surface of the version-skew guard
 * (the first is the DaemonSkewToast).
 */
export function TitleBar(): React.JSX.Element {
  const setFinderOpen = useFileFinderStore((s) => s.setOpen)
  const remote = useActiveRemoteEnvironment()
  const skew = useDaemonSkew()
  const openSettings = useSettingsDialogStore((s) => s.openTo)

  return (
    <div className="app-drag flex h-12 shrink-0 items-center border-border/60 border-b px-3">
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
      {/* Right inset mirrors traffic lights when local; expands for the Remote chip
          and (Linux/Windows) the custom window controls. */}
      <div
        className={cn(
          'app-no-drag flex shrink-0 items-center justify-end gap-1',
          isLinuxShell ? 'min-w-24 pl-2' : remote ? 'min-w-16 pl-2' : 'w-16',
        )}
      >
        {remote && (
          <Tooltip>
            <TooltipTrigger
              render={
                <button
                  type="button"
                  onClick={() => openSettings('environments')}
                  aria-label={
                    skew
                      ? `Remote environment: ${remote.name} — daemon version mismatch`
                      : `Remote environment: ${remote.name}`
                  }
                  className="flex max-w-48 items-center gap-1.5 rounded-md border border-border bg-secondary px-2 py-1 text-xs font-medium text-secondary-foreground transition-colors hover:bg-[color-mix(in_oklch,var(--secondary),var(--foreground)_5%)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
                >
                  <Cloud className="size-3.5 shrink-0 opacity-80" aria-hidden />
                  <span className="truncate">{remote.name}</span>
                  {skew && <TriangleAlert className="size-3.5 shrink-0 text-warning" aria-hidden />}
                </button>
              }
            />
            {/* Anchored to the chip's right edge and opening downward so it can't be
                clipped by the window's right side; the name/url never wrap, only the
                longer skew sentence does. */}
            <TooltipContent side="bottom" align="end" className="max-w-sm">
              <div className="flex flex-col gap-0.5 text-left">
                <p className="whitespace-nowrap font-medium">{remote.name}</p>
                <p className="whitespace-nowrap font-mono text-xs text-muted-foreground">
                  {remote.url}
                </p>
                {skew && <p className="mt-1 text-xs text-warning">{skew.message}</p>}
                <p className="mt-1 text-xs text-muted-foreground">Click to manage environments</p>
              </div>
            </TooltipContent>
          </Tooltip>
        )}
        {isLinuxShell && <WindowControls />}
      </div>
    </div>
  )
}
