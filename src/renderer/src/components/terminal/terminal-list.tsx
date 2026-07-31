import { SidebarHeaderActions } from '@renderer/components/shell/sidebar-header-actions'
import {
  LocalPathDialog,
  type LocalPathDialogMode,
} from '@renderer/components/terminal/local-path-dialog'
import { TerminalRenameDialog } from '@renderer/components/terminal/terminal-rename-dialog'
import { Button } from '@renderer/components/ui/button'
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuTrigger,
} from '@renderer/components/ui/context-menu'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@renderer/components/ui/dropdown-menu'
import { useDaemonIdentity } from '@renderer/hooks/use-daemon-identity'
import { useLocalDaemon, useLocalTerminalPath } from '@renderer/hooks/use-local-terminal'
import { spawnLocalTerminal, spawnTerminal } from '@renderer/lib/terminal-actions'
import { cn } from '@renderer/lib/utils'
import { useRepoStore } from '@renderer/stores/repo'
import { tabId, useTabsStore } from '@renderer/stores/tabs'
import { useTerminalsStore } from '@renderer/stores/terminals'
import { TestIds } from '@shared/test-ids'
import { Cloud, FolderPen, Monitor, PenLine, Plus, SquareTerminal, X } from 'lucide-react'
import { useState } from 'react'

/**
 * The Terminal sidebar tab body: the roster of open terminal sessions. "+" spawns a
 * new shell and opens it; a row click opens/focuses its viewer tab; "x" kills the PTY.
 * Sessions are independent of tabs — closing a tab keeps the session here (a background
 * dev server keeps running), so this roster is how you get back to it. Mirrors the
 * Board/Feature tabs: a list here, the live surface in the viewer.
 *
 * When the window is bound to a remote daemon, the header gains a folder icon (set the
 * local clone path for "This device" shells) and "+" becomes a menu (this window's
 * machine vs This device). Local windows keep a plain "+" that just opens a shell.
 */
export function TerminalList(): React.JSX.Element {
  const sessions = useTerminalsStore((s) => s.sessions)
  const closeTerminal = useTerminalsStore((s) => s.close)
  const renameTerminal = useTerminalsStore((s) => s.rename)
  const repo = useRepoStore((s) => s.repo)
  const openTab = useTabsStore((s) => s.openTab)
  const retitleTerminalTab = useTabsStore((s) => s.retitleTerminalTab)
  const activeTabId = useTabsStore((s) => {
    const pane = s.panes[s.activePaneIndex]
    return pane?.activeTabId ?? null
  })
  // The session being renamed (id + its current label to prefill), or null when no
  // rename is in flight. Single-surface, so it's plain component state (unlike the
  // file prompt, which is opened from two surfaces and lives in a store).
  const [renaming, setRenaming] = useState<{ id: string; name: string } | null>(null)
  // "This device" terminals exist only when this window is on ANOTHER machine; on a local
  // window the option would just be a second way to spawn the same shell.
  const localDaemon = useLocalDaemon()
  const canSpawnLocal = localDaemon !== undefined && !localDaemon.isLocal && repo !== null
  const mappedLocalPath = useLocalTerminalPath(repo?.path ?? null)
  const identity = useDaemonIdentity()
  // Path dialog: 'spawn' also opens a terminal after save; 'edit' only updates the map.
  const [mappingMode, setMappingMode] = useState<LocalPathDialogMode | null>(null)

  const spawnLocal = async (): Promise<void> => {
    if (!repo) return
    if (mappedLocalPath == null || mappedLocalPath === '') {
      setMappingMode('spawn')
      return
    }
    await spawnLocalTerminal(mappedLocalPath)
  }

  const open = (id: string, name: string): void => {
    openTab({ id: tabId('terminal', id), kind: 'terminal', title: name, path: id })
  }

  const rename = (id: string, name: string): void => {
    const trimmed = name.trim()
    if (trimmed === '') return
    renameTerminal(id, trimmed)
    retitleTerminalTab(id, trimmed)
  }

  const hasMappedPath = mappedLocalPath != null && mappedLocalPath !== ''

  return (
    <div data-testid={TestIds.terminalList} className="flex flex-col gap-1.5">
      <div className="flex items-center justify-end px-2">
        <SidebarHeaderActions>
          {canSpawnLocal && (
            <Button
              variant="ghost"
              size="icon-sm"
              onClick={() => setMappingMode('edit')}
              aria-label={hasMappedPath ? 'Change this device folder' : 'Set this device folder'}
              title={
                hasMappedPath
                  ? `This device folder: ${mappedLocalPath}`
                  : 'Set this device folder (local clone of this repo)'
              }
              data-testid={TestIds.localTerminalPathButton}
              disabled={!repo}
            >
              <FolderPen />
            </Button>
          )}
          {canSpawnLocal ? (
            <DropdownMenu>
              <DropdownMenuTrigger
                render={
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    aria-label="New terminal"
                    data-testid={TestIds.terminalNew}
                  >
                    <Plus />
                  </Button>
                }
              />
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={spawnTerminal} data-testid={TestIds.terminalNewRemote}>
                  <Cloud />
                  {identity.host ?? 'This window’s machine'}
                </DropdownMenuItem>
                <DropdownMenuItem onClick={spawnLocal} data-testid={TestIds.terminalNewLocal}>
                  <Monitor />
                  This device
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          ) : (
            <Button
              variant="ghost"
              size="icon-sm"
              onClick={spawnTerminal}
              aria-label="New terminal"
              data-testid={TestIds.terminalNew}
              disabled={!repo}
            >
              <Plus />
            </Button>
          )}
        </SidebarHeaderActions>
      </div>
      <div className="flex flex-col gap-0.5 px-2">
        {sessions.map((session) => {
          const isActive = activeTabId === tabId('terminal', session.id)
          return (
            <ContextMenu key={session.id}>
              <ContextMenuTrigger
                render={
                  <div
                    className={cn(
                      'group/term flex h-7 items-center gap-2 rounded-md px-2 text-sm-minus',
                      isActive
                        ? 'bg-sidebar-accent text-foreground'
                        : 'text-muted-foreground hover:bg-sidebar-accent/50',
                    )}
                  >
                    <button
                      type="button"
                      onClick={() => open(session.id, session.name)}
                      onDoubleClick={() => setRenaming({ id: session.id, name: session.name })}
                      title={
                        session.origin === 'local' ? `${session.name} — this device` : session.name
                      }
                      className="flex min-w-0 flex-1 items-center gap-2 text-left"
                    >
                      {/* The icon carries local-vs-remote (same Monitor/Cloud language as
                          the environment switcher). A text badge said it more loudly but
                          squeezed the name to "Termina…" in a 192px panel — the row's job
                          is the name. */}
                      {session.origin === 'local' ? (
                        <Monitor className="size-3.5 shrink-0" />
                      ) : (
                        <SquareTerminal className="size-3.5 shrink-0" />
                      )}
                      <span className="min-w-0 flex-1 truncate">{session.name}</span>
                    </button>
                    {session.status === 'exited' ? (
                      <span className="shrink-0 text-2xs uppercase tracking-wider text-muted-foreground/60">
                        exited
                      </span>
                    ) : (
                      <span className="size-1.5 shrink-0 rounded-full bg-emerald-500" aria-hidden />
                    )}
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      className="size-5 shrink-0 opacity-0 group-hover/term:opacity-100 [@media(hover:none)]:opacity-100"
                      aria-label={`Close ${session.name}`}
                      onClick={() => closeTerminal(session.id)}
                    >
                      <X />
                    </Button>
                  </div>
                }
              />
              <ContextMenuContent>
                <ContextMenuItem
                  onClick={() => setRenaming({ id: session.id, name: session.name })}
                >
                  <PenLine />
                  Rename
                </ContextMenuItem>
              </ContextMenuContent>
            </ContextMenu>
          )
        })}
        {sessions.length === 0 && (
          <div className="px-3 py-10 text-center">
            <p className="text-xs font-medium text-foreground">No terminals</p>
            <p className="mx-auto mt-1 max-w-[15rem] text-xs text-muted-foreground">
              Add one with +, or run an action from Quick access.
            </p>
          </div>
        )}
      </div>
      {renaming && (
        <TerminalRenameDialog
          key={renaming.id}
          initialName={renaming.name}
          onRename={(name: string): void => rename(renaming.id, name)}
          onClose={() => setRenaming(null)}
        />
      )}
      {mappingMode && repo && (
        <LocalPathDialog
          key={`${mappingMode}:${mappedLocalPath ?? ''}`}
          repoPath={repo.path}
          initialPath={mappedLocalPath ?? null}
          mode={mappingMode}
          // Spawn mode opens a terminal from the just-saved value (query invalidation
          // hasn't landed yet). Edit mode only updates the map — the human asked for a
          // setting, not a shell.
          onSaved={(localPath: string): void => {
            if (mappingMode === 'spawn') spawnLocalTerminal(localPath)
          }}
          onClose={() => setMappingMode(null)}
        />
      )}
    </div>
  )
}
