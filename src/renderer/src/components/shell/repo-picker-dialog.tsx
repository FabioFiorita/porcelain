import { Button } from '@renderer/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@renderer/components/ui/dialog'
import { ScrollArea } from '@renderer/components/ui/scroll-area'
import { useBrowseDirs } from '@renderer/hooks/use-browse'
import { useRemoteEnvironments } from '@renderer/hooks/use-remote-daemon'
import { isBrowser } from '@renderer/lib/platform'
import { cn } from '@renderer/lib/utils'
import { useRepoStore } from '@renderer/stores/repo'
import { useRepoPickerStore } from '@renderer/stores/repo-picker'
import { useSettingsDialogStore } from '@renderer/stores/settings-dialog'
import { CornerLeftUp, Folder, FolderGit2 } from 'lucide-react'
import { useState } from 'react'

/** Turn a raw tRPC/fetch error into a short, actionable line for the picker. */
function browseErrorMessage(error: { message: string }, remoteName: string | null): string {
  const raw = error.message
  // fetch() TypeError surfaces as "Failed to fetch" when the daemon is unreachable
  // or CSP/CORS blocked the request — the connect probe (main process) can still
  // have succeeded, so point the human at the remote settings escape hatch.
  if (/failed to fetch|networkerror|load failed|econnrefused|enotfound/i.test(raw)) {
    if (remoteName != null) {
      return `Can't reach ${remoteName}. Check that the daemon is running and Share on local network / Tailscale is on, or disconnect in Settings.`
    }
    return "Can't reach the Porcelain daemon. Try again in a moment."
  }
  return raw
}

/**
 * The daemon-side directory browser that opens a repo — mounted once in AppShell so it
 * covers both the welcome screen and the repo shell. Replaces the native open-folder
 * dialog: repos are daemon paths, so with a remote daemon the picker must browse ITS
 * filesystem (remote-envs decision 5), giving local and remote one code path.
 *
 * Open/closed intent lives in the repo-picker store (the file-prompt "compose intent"
 * pattern); the browsing path lives here and resets on each open (start at the daemon
 * home, `null`). Clicking a plain dir navigates in; the up row goes to the parent;
 * a repo row navigates too but its primary action opens it. "Open this folder" opens
 * the CURRENT path (any-directory semantics, like the old dialog — openRepoPath handles
 * non-repos as it always has).
 */
export function RepoPickerDialog(): React.JSX.Element | null {
  const open = useRepoPickerStore((s) => s.open)
  const hide = useRepoPickerStore((s) => s.hide)

  if (!open) return null
  return <RepoPicker onClose={hide} />
}

function RepoPicker({ onClose }: { onClose: () => void }): React.JSX.Element {
  // null = the daemon home; a fresh browse each open (no persistence).
  const [path, setPath] = useState<string | null>(null)
  const { result, error, isFetching } = useBrowseDirs(path, true)
  const remote = useRemoteEnvironments()
  const activeRemote =
    !isBrowser && remote?.activeId != null
      ? (remote.environments.find((env) => env.id === remote.activeId) ?? null)
      : null

  // openRepoPath is a store action (the sanctioned cross-store call from a component);
  // it records the recent + warms the file list daemon-side, then this dialog closes.
  const open = async (target: string): Promise<void> => {
    await useRepoStore.getState().openRepoPath(target)
    onClose()
  }

  const currentPath = result?.path ?? ''

  return (
    <Dialog
      open
      onOpenChange={(next) => {
        if (!next) onClose()
      }}
    >
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Open repository</DialogTitle>
          {/* Truncate the deep end off the LEFT so the folder name stays visible. */}
          <p
            className="truncate font-mono text-xs text-muted-foreground"
            dir="rtl"
            title={currentPath}
          >
            {currentPath || (error ? '—' : '…')}
          </p>
          {activeRemote != null && (
            <p className="text-2xs text-muted-foreground">
              Browsing {activeRemote.name}
              <span className="font-mono"> ({activeRemote.url})</span>
            </p>
          )}
        </DialogHeader>

        <ScrollArea className="h-72 rounded-md border">
          <div className="flex flex-col p-1">
            <button
              type="button"
              disabled={!result || result.parent === null}
              onClick={() => result?.parent && setPath(result.parent)}
              className={cn(
                'flex items-center gap-2.5 rounded-md px-2 py-1.5 text-left text-sm',
                'hover:bg-accent/50 disabled:pointer-events-none disabled:opacity-40',
                'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50',
              )}
            >
              <CornerLeftUp className="size-4 shrink-0 text-muted-foreground" />
              <span className="text-muted-foreground">Up</span>
            </button>

            {result?.entries.map((entry) => (
              <div
                key={entry.path}
                className={cn(
                  'group flex items-center gap-2.5 rounded-md pr-1.5 text-sm',
                  'hover:bg-accent/50',
                )}
              >
                <button
                  type="button"
                  onClick={() => setPath(entry.path)}
                  className="flex min-w-0 flex-1 items-center gap-2.5 rounded-md px-2 py-1.5 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
                >
                  {entry.isRepo ? (
                    <FolderGit2 className="size-4 shrink-0 text-primary" />
                  ) : (
                    <Folder className="size-4 shrink-0 text-muted-foreground" />
                  )}
                  <span className="truncate">{entry.name}</span>
                  {entry.isRepo && (
                    <span className="text-2xs font-medium uppercase tracking-wider text-muted-foreground">
                      repo
                    </span>
                  )}
                </button>
                {entry.isRepo && (
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-6 shrink-0 px-2 text-xs opacity-0 group-hover:opacity-100 focus-visible:opacity-100"
                    onClick={() => open(entry.path)}
                  >
                    Open
                  </Button>
                )}
              </div>
            ))}

            {result && result.entries.length === 0 && (
              <p className="px-2 py-6 text-center text-xs text-muted-foreground">No folders here</p>
            )}
          </div>
        </ScrollArea>

        {error && (
          <div className="flex flex-col gap-1.5">
            <p className="text-xs text-destructive">
              {browseErrorMessage(error, activeRemote?.name ?? null)}
            </p>
            {activeRemote != null && (
              <button
                type="button"
                className="self-start text-xs text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
                onClick={() => {
                  onClose()
                  useSettingsDialogStore.getState().openTo('general')
                }}
              >
                Open remote daemon settings
              </button>
            )}
          </div>
        )}

        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button disabled={!result || isFetching} onClick={() => currentPath && open(currentPath)}>
            Open this folder
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
