import { Badge } from '@renderer/components/ui/badge'
import { Button } from '@renderer/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@renderer/components/ui/dialog'
import { ScrollArea } from '@renderer/components/ui/scroll-area'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@renderer/components/ui/select'
import {
  useHubInventories,
  useOpenProject,
  useProjectDirectories,
} from '@renderer/features/projects'
import { toastUserActionError } from '@renderer/hooks/mutation-error'
import { rowActionClass } from '@renderer/lib/controls'
import { cn } from '@renderer/lib/utils'
import { useProjectPickerStore } from '@renderer/stores/project-picker'
import { useSettingsDialogStore } from '@renderer/stores/settings-dialog'
import { runUserAction } from '@shared/background'
import { TestIds } from '@shared/test-ids'
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
      return `Can't reach ${remoteName}. Check that the daemon is running and Local network / Tailscale sharing is on, or disconnect in Settings.`
    }
    return "Can't reach the Porcelain daemon. Try again in a moment."
  }
  return raw
}

/**
 * The daemon-side directory browser that opens a Project — mounted once in AppShell
 * for both the welcome screen and Project shell. With a remote daemon it must browse
 * ITS filesystem (remote-envs decision 5), giving local/remote one code path.
 *
 * Browsing path resets on each open (starts at daemon home, `null`); "Open this
 * folder" opens the CURRENT path even for a non-repo (any-directory semantics).
 */
export function ProjectPickerDialog(): React.JSX.Element | null {
  const open = useProjectPickerStore((s) => s.open)
  const environmentId = useProjectPickerStore((s) => s.environmentId)
  const hide = useProjectPickerStore((s) => s.hide)

  if (!open) return null
  return <ProjectPicker initialEnvironmentId={environmentId} onClose={hide} />
}

function ProjectPicker({
  initialEnvironmentId,
  onClose,
}: {
  initialEnvironmentId: string | null
  onClose: () => void
}): React.JSX.Element {
  // null = the daemon home; a fresh browse each open (no persistence).
  const [path, setPath] = useState<string | null>(null)
  const inventories = useHubInventories()
  const current = inventories.find((source) => source.current) ?? null
  /** The daemon-announced id of the Environment being browsed; null until one is chosen. */
  const [chosenId, setChosenId] = useState<string | null>(initialEnvironmentId)
  const target =
    inventories.find(
      (source) => source.inventory.environment.id === chosenId || source.environmentId === chosenId,
    ) ?? current
  const browsingElsewhere = target !== null && !target.current
  // `null` addresses this window's own daemon directly; anything else resolves the session
  // the shell handed over for that machine.
  const { result, error, isFetching } = useProjectDirectories(
    path,
    true,
    browsingElsewhere ? target.inventory.environment.id : null,
  )
  const openProject = useOpenProject()

  const retarget = (id: string): void => {
    if (id === target?.inventory.environment.id) return
    setChosenId(id)
    // The path on screen is a path on the PREVIOUS machine. Start again at the new daemon's
    // home rather than asking it about a directory it has never had.
    setPath(null)
  }

  // The Projects adapter records the recent, selects the authoritative result, and then this
  // dialog closes. A secondary Environment is addressed through its live renderer session,
  // just like the Hub and Settings project pickers.
  const handleOpen = (repoPath: string): void => {
    runUserAction(
      async () => {
        await openProject.open(repoPath, {
          environmentId: browsingElsewhere ? target.inventory.environment.id : null,
        })
        onClose()
      },
      (error) => {
        toastUserActionError('Open project', error)
      },
    )
  }

  const currentPath = result?.path ?? ''

  return (
    <Dialog
      open
      onOpenChange={(next: boolean): void => {
        if (!next) onClose()
      }}
    >
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Open project</DialogTitle>
          {/* Which machine's filesystem this is. With one Environment there is nothing to
              choose and no control appears; with several, the answer used to be a line of
              grey text — and the wrong one is how a path that exists on the Beelink gets
              opened against the Mac. */}
          {inventories.length > 1 && (
            <Select
              // Without `items` the trigger shows the raw value — an Environment UUID.
              items={inventories.map((source) => ({
                label: source.current
                  ? `${source.inventory.environment.name} · current Environment`
                  : source.inventory.environment.name,
                value: source.inventory.environment.id,
              }))}
              value={target?.inventory.environment.id}
              onValueChange={(value: string | null): void => {
                if (value !== null) retarget(value)
              }}
            >
              <SelectTrigger
                className="h-8 w-full text-sm-minus"
                data-testid={TestIds.projectPickerEnvironment}
              >
                <SelectValue placeholder="Choose an Environment" />
              </SelectTrigger>
              <SelectContent>
                {inventories.map((source) => (
                  <SelectItem
                    key={source.inventory.environment.id}
                    value={source.inventory.environment.id}
                  >
                    {source.inventory.environment.name}
                    {source.current ? ' · current Environment' : ''}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
          {/* Truncate the deep end off the LEFT so the folder name stays visible. */}
          <p
            className="truncate font-mono text-xs text-muted-foreground"
            dir="rtl"
            title={currentPath}
          >
            {currentPath || (error ? '—' : '…')}
          </p>
          <p className="text-xs text-muted-foreground">
            Git repositories appear in Projects. Other folders open as a workspace only.
          </p>
        </DialogHeader>

        <ScrollArea className="h-72 rounded-md border">
          <div className="flex flex-col p-1">
            <button
              type="button"
              disabled={!result || result.parent === null}
              onClick={() => result?.parent && setPath(result.parent)}
              className={cn(
                'flex items-center gap-2.5 rounded-md px-2 py-1.5 text-left text-sm-minus',
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
                  'group flex items-center gap-2.5 rounded-md pr-1.5 text-sm-minus',
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
                  <span className="truncate font-mono">{entry.name}</span>
                  {entry.isRepo && (
                    <Badge
                      variant="outline"
                      className="rounded-md border-border/60 text-2xs uppercase tracking-wider text-muted-foreground"
                    >
                      project
                    </Badge>
                  )}
                </button>
                {entry.isRepo && (
                  <Button
                    variant="ghost"
                    className={cn(
                      rowActionClass,
                      'shrink-0 opacity-0 group-hover:opacity-100 focus-visible:opacity-100 [@media(hover:none)]:opacity-100',
                    )}
                    onClick={() => handleOpen(entry.path)}
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
              {browseErrorMessage(
                error,
                browsingElsewhere ? target.inventory.environment.name : null,
              )}
            </p>
            {browsingElsewhere && (
              <button
                type="button"
                className="self-start text-xs text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
                onClick={() => {
                  onClose()
                  useSettingsDialogStore.getState().openTo('remotes')
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
          <Button
            disabled={!result || isFetching}
            onClick={() => currentPath && handleOpen(currentPath)}
          >
            Open this folder
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
