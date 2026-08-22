import { terminalSessionsQuery } from '@porcelain/client-runtime/terminal'
import type { TerminalInfo } from '@porcelain/contracts/terminal'
import {
  LocalPathDialog,
  type LocalPathDialogMode,
} from '@renderer/components/terminal/local-path-dialog'
import { TerminalRenameDialog } from '@renderer/components/terminal/terminal-rename-dialog'
import { TerminalView } from '@renderer/components/terminal/terminal-view'
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
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@renderer/components/ui/dropdown-menu'
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from '@renderer/components/ui/empty'
import { Tooltip, TooltipContent, TooltipTrigger } from '@renderer/components/ui/tooltip'
import { useHubInventory, useProjectDirectories } from '@renderer/features/projects'
import {
  ENVIRONMENT_GROUP_KEY,
  groupTerminalSessions,
  listTerminalSessionsOnDaemon,
  type TerminalGroup,
  terminalAdapterFor,
  terminalLocationGroups,
  terminalLocationLabel,
  terminalLocations,
  terminalSessionsQueryKey,
} from '@renderer/features/terminal'
import { toastingAction, toastUserActionError } from '@renderer/hooks/mutation-error'
import { useDaemonIdentity, useEnvironmentName } from '@renderer/hooks/use-daemon-identity'
import { useLocalDaemon, useLocalTerminalPath } from '@renderer/hooks/use-local-terminal'
import { spawnLocalTerminal, spawnTerminalAt } from '@renderer/lib/terminal-actions'
import { trpc } from '@renderer/lib/trpc'
import { cn } from '@renderer/lib/utils'
import { useProjectSelectionStore } from '@renderer/stores/project-selection'
import { useTerminalsStore } from '@renderer/stores/terminals'
import { runUserAction, settleBackground } from '@shared/background'
import { TestIds } from '@shared/test-ids'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import {
  Cloud,
  FolderGit2,
  GitBranch,
  FolderPen,
  Grid2x2,
  Layers,
  Monitor,
  PenLine,
  Plus,
  SquareTerminal,
  X,
} from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'

/**
 * The Terminals surface: the ONE place a shell is shown in this app.
 *
 * It leads with the Environment's own shells — the daemon host's home, where a multiplexer
 * or an agent herd lives — and lists the Project/Worktree groups under it, resolved by
 * longest `cwd` prefix (`client-runtime/terminal/terminal-groups.ts`, shared with the mobile
 * Terminals tab), because a daemon terminal carries no project id on the wire. Saved Actions
 * are NOT here: they run in the selected Worktree wherever they are started from, so they stay
 * in the header popover, reachable from any tab — running one still lands here, on the shell
 * it started.
 *
 * Deliberately NOT scoped to the Hub selection: a long-lived process stays reachable while
 * you review a different Project. The daemon owns the sessions, so the list survives a
 * reload; which one this board shows is client state (`terminals.focusedId`) and does not.
 *
 * Two rosters feed one list. The primary daemon's global roster is polled here, and the
 * repo-scoped `terminals` store is merged in by id — that store is the only thing that can
 * see a "This device" shell or one on a selected secondary Environment. This board ATTACHES
 * but never subscribes: `useTerminalRoster` owns the data listeners, and a second
 * `receiveData` subscriber would write every byte to the Ghostty surface twice.
 */

const MAX_GRID_PANES = 4

/**
 * Shells the Environment row can start. Fixed literal names, not the Environment nickname:
 * these are found again BY name on the next visit, and a nickname is display text the human
 * can change at any time. `initialInput` is a create-time field, so a multiplexer shortcut
 * is a spawn, never a write into an existing shell.
 */
const ENVIRONMENT_SHELLS = [
  { key: 'herdr', label: 'herdr', name: 'herdr', initialInput: 'herdr' },
  { key: 'tmux', label: 'tmux', name: 'tmux', initialInput: 'tmux new -A -s porcelain' },
] as const

/** Cap the grid so a herd of shells cannot render dozens of live Ghostty surfaces at once. */
function gridSessions(groups: readonly TerminalGroup[], focusedId: string | null): TerminalInfo[] {
  const running = groups.flatMap((group) =>
    group.sessions.filter((session) => session.status === 'running'),
  )
  const focused = running.filter((session) => session.id === focusedId)
  const rest = running.filter((session) => session.id !== focusedId)
  return [...focused, ...rest].slice(0, MAX_GRID_PANES)
}

export function TerminalsBoard(): React.JSX.Element {
  const daemon = useDaemonIdentity()
  const environmentName = useEnvironmentName()
  const client = trpc.useUtils().client
  const queryClient = useQueryClient()
  const inventory = useHubInventory()
  const focusedId = useTerminalsStore((s) => s.focusedId)
  const focus = useTerminalsStore((s) => s.focus)
  const closeTerminal = useTerminalsStore((s) => s.close)
  const renameTerminal = useTerminalsStore((s) => s.rename)
  const storeRows = useTerminalsStore((s) => s.sessions)
  const project = useProjectSelectionStore((s) => s.project)
  const localDaemon = useLocalDaemon()
  const mappedLocalPath = useLocalTerminalPath(project?.path ?? null)
  const canSpawnLocal = localDaemon !== undefined && !localDaemon.isLocal && project !== null
  const [grid, setGrid] = useState(false)
  const [renaming, setRenaming] = useState<{ id: string; name: string } | null>(null)
  const [mappingMode, setMappingMode] = useState<LocalPathDialogMode | null>(null)
  // Rows this window killed. The daemon's next poll is up to five seconds away, and a row
  // that lingers after its X looks like the kill failed.
  const [dismissed, setDismissed] = useState<ReadonlySet<string>>(() => new Set())

  // Same daemon-global key the roster hook uses, so both share one cache row — but this
  // board must poll even with no repo open (the roster's copy is disabled until one is).
  const sessionsKey = terminalSessionsQueryKey(
    { host: daemon.host, version: daemon.version },
    terminalSessionsQuery(),
  )
  const sessionsQuery = useQuery({
    queryKey: sessionsKey,
    queryFn: async () => listTerminalSessionsOnDaemon(client),
    refetchInterval: 5000,
  })

  // The Environment root is the daemon host's home — the same directory the Project browser
  // starts in. Cached hard: a home directory does not move while the window is open.
  const environmentRoot = useProjectDirectories(null, true).result?.path ?? null

  const locations = useMemo(
    () => terminalLocations(inventory?.projects ?? []),
    [inventory?.projects],
  )
  const locationGroups = useMemo(() => terminalLocationGroups(locations), [locations])

  // One list from two rosters. The global poll is authoritative for the primary daemon; the
  // store contributes the rows it cannot see at all (local origin, secondary Environment).
  const rosterSessions = useMemo<TerminalInfo[]>(() => {
    const byId = new Map<string, TerminalInfo>()
    for (const session of sessionsQuery.data ?? []) byId.set(session.id, session)
    for (const row of storeRows) {
      if (byId.has(row.id)) continue
      byId.set(row.id, {
        id: row.id,
        name: row.name,
        cwd: row.cwd,
        status: row.status,
        exitCode: row.exitCode,
        createdAt: row.createdAt,
      })
    }
    return [...byId.values()]
  }, [sessionsQuery.data, storeRows])

  const allSessions = useMemo(
    () => rosterSessions.filter((session) => !dismissed.has(session.id)),
    [dismissed, rosterSessions],
  )

  // Retire a dismissal once the roster agrees the row is gone. Without this the set only
  // ever grows, and it is the thing hiding a row from the ONE surface that lists shells.
  useEffect(() => {
    setDismissed((current) => {
      if (current.size === 0) return current
      const live = new Set(rosterSessions.map((session) => session.id))
      const next = new Set([...current].filter((id) => live.has(id)))
      return next.size === current.size ? current : next
    })
  }, [rosterSessions])

  const localOrigins = useMemo(
    () => new Set(storeRows.filter((row) => row.origin === 'local').map((row) => row.id)),
    [storeRows],
  )

  const groups = useMemo(
    () => groupTerminalSessions(allSessions, locations, environmentRoot),
    [allSessions, environmentRoot, locations],
  )
  const sessions = useMemo(() => groups.flatMap((group) => group.sessions), [groups])
  // The grid toggle only means something with a second shell to put beside the first, and an
  // unexplained glyph that does nothing is worse than no button. It appears when it applies.
  const canGrid = sessions.filter((session) => session.status === 'running').length > 1
  const environmentSessions = useMemo(
    () => groups.find((group) => group.key === ENVIRONMENT_GROUP_KEY)?.sessions ?? [],
    [groups],
  )
  const visible = useMemo(() => {
    if (grid) return gridSessions(groups, focusedId)
    const focused = sessions.find((session) => session.id === focusedId)
    return focused === undefined ? [] : [focused]
  }, [focusedId, grid, groups, sessions])

  // Follow the roster: land on the first session, and don't strand the board on a killed one.
  // Safe to reconcile eagerly because a just-created row is held in the store until a roster
  // that could actually know about it arrives (`freshCreates` in stores/terminals.ts).
  useEffect(() => {
    // Not while the roster is cold: after `gcTime` this board remounts with no data and
    // would immediately un-focus the session the human was watching.
    if (sessionsQuery.data === undefined && storeRows.length === 0) return
    if (focusedId !== null && sessions.some((session) => session.id === focusedId)) return
    focus(sessions[0]?.id ?? null)
  }, [focus, focusedId, sessions, sessionsQuery.data, storeRows.length])

  // Attach only what is on screen. The PTY is already streaming to its daemon session; the
  // app-wide roster subscription owns the data listeners, so attaching here just replays
  // scrollback into the registry. Never subscribe listeners from this board.
  useEffect(() => {
    for (const session of visible) {
      const adapter = terminalAdapterFor(session.id)
      if (adapter.isTerminalAttached(session.id)) continue
      settleBackground(adapter.attachTerminal(session.id), 'lifecycle')
    }
  }, [visible])

  const refreshRoster = async (): Promise<void> => {
    await queryClient.invalidateQueries({ queryKey: sessionsKey })
  }

  /**
   * Spawn through the shared roster action, not straight at the adapter: `revealTerminal` is
   * then the single place a new shell is put in front of the human, whether it started here,
   * from a saved Action, or from a Worktree lifecycle script.
   */
  const spawnAt = async (cwd: string, opts?: { name?: string; initialInput?: string }) => {
    await spawnTerminalAt(cwd, opts)
    await refreshRoster()
  }

  /** Find this Environment shell by name before starting a second one. */
  const openEnvironmentShell = async (name: string, initialInput?: string): Promise<void> => {
    const existing = environmentSessions.find(
      (session) => session.name === name && session.status === 'running',
    )
    if (existing !== undefined) {
      focus(existing.id)
      return
    }
    if (environmentRoot === null) return
    await spawnAt(environmentRoot, { name, initialInput })
  }

  const handleSpawnLocal = (): void => {
    if (project === null) return
    if (mappedLocalPath == null || mappedLocalPath === '') {
      setMappingMode('spawn')
      return
    }
    runUserAction(
      () => spawnLocalTerminal(mappedLocalPath),
      (error) => {
        toastUserActionError('Open local terminal', error)
      },
    )
  }

  /**
   * Kill a shell from the list, attaching first when this window has never shown it.
   *
   * The kill frame is only minted for a session this client knows (`terminal-stream.kill`
   * refuses an unknown id), and the board lists every shell on the daemon — including ones
   * started in another window. Without the attach, X on an unopened row did nothing at all.
   */
  const handleClose = (id: string): void => {
    setDismissed((current) => new Set(current).add(id))
    settleBackground(
      (async () => {
        try {
          const adapter = terminalAdapterFor(id)
          if (!adapter.isTerminalAttached(id)) await adapter.attachTerminal(id)
          closeTerminal(id)
        } catch (error) {
          // The kill never went out, so the PTY is still alive — show the row again rather
          // than hide a running shell from the only surface that lists it.
          setDismissed((current) => {
            const next = new Set(current)
            next.delete(id)
            return next
          })
          toastUserActionError('Close terminal', error)
        }
        await refreshRoster()
      })(),
      'fallback',
    )
  }

  const sessionRow = (session: TerminalInfo): React.JSX.Element => {
    const isLocal = localOrigins.has(session.id)
    return (
      <ContextMenu key={session.id}>
        <ContextMenuTrigger
          render={
            <div
              className={cn(
                'group/term flex h-7 w-full min-w-0 items-center gap-2 rounded-md pr-1 pl-2 text-xs',
                session.id === focusedId
                  ? 'bg-accent text-accent-foreground'
                  : 'text-muted-foreground hover:bg-accent/50',
              )}
            >
              <button
                type="button"
                data-testid={TestIds.terminalsBoardSession(session.id)}
                aria-current={session.id === focusedId ? 'true' : undefined}
                title={isLocal ? `${session.name} — this device` : session.name}
                className="flex min-w-0 flex-1 items-center gap-2 text-left"
                onClick={() => focus(session.id)}
                onDoubleClick={() => setRenaming({ id: session.id, name: session.name })}
              >
                {isLocal ? (
                  <Monitor className="size-3.5 shrink-0" />
                ) : (
                  <SquareTerminal className="size-3.5 shrink-0" />
                )}
                <span className="min-w-0 flex-1 truncate">{session.name}</span>
                {session.status === 'exited' && <span className="shrink-0">exited</span>}
              </button>
              <Button
                variant="ghost"
                size="icon-xs"
                className="size-5 shrink-0 opacity-0 group-hover/term:opacity-100 [@media(hover:none)]:opacity-100"
                aria-label={`Close ${session.name}`}
                data-testid={TestIds.terminalsBoardClose(session.id)}
                onClick={() => handleClose(session.id)}
              >
                <X />
              </Button>
            </div>
          }
        />
        <ContextMenuContent>
          <ContextMenuItem onClick={() => setRenaming({ id: session.id, name: session.name })}>
            <PenLine />
            Rename
          </ContextMenuItem>
        </ContextMenuContent>
      </ContextMenu>
    )
  }

  return (
    <div className="flex h-full min-h-0" data-testid={TestIds.terminalsBoard}>
      <div className="flex w-64 min-w-0 shrink-0 flex-col border-r">
        <div className="flex h-9 shrink-0 items-center gap-1 border-b px-2">
          <span className="min-w-0 flex-1 truncate text-xs font-medium">Terminals</span>
          {/* Two glyph-only buttons sat side by side with nothing saying what either did.
              The grid one is the obscure half, so it says so on hover. */}
          {canGrid && (
            <Tooltip>
              <TooltipTrigger
                render={
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    aria-label="Grid layout"
                    aria-pressed={grid}
                    data-testid={TestIds.terminalsBoardGrid}
                    className={cn(grid && 'bg-accent text-accent-foreground')}
                    onClick={() => setGrid((current) => !current)}
                  >
                    <Grid2x2 />
                  </Button>
                }
              />
              <TooltipContent>
                {grid ? 'Show one terminal' : `Show up to ${MAX_GRID_PANES} terminals at once`}
              </TooltipContent>
            </Tooltip>
          )}
          {canSpawnLocal && (
            <Button
              variant="ghost"
              size="icon-sm"
              onClick={() => setMappingMode('edit')}
              aria-label={mappedLocalPath ? 'Change this device folder' : 'Set this device folder'}
              title={
                mappedLocalPath
                  ? `This device folder: ${mappedLocalPath}`
                  : 'Set this device folder (local clone of this project)'
              }
              data-testid={TestIds.localTerminalPathButton}
            >
              <FolderPen />
            </Button>
          )}
          <DropdownMenu>
            <Tooltip>
              <TooltipTrigger
                render={
                  <DropdownMenuTrigger
                    render={
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        aria-label="New terminal"
                        data-testid={TestIds.terminalsBoardNew}
                      >
                        <Plus />
                      </Button>
                    }
                  />
                }
              />
              <TooltipContent>New terminal</TooltipContent>
            </Tooltip>
            {/* The menu inherits the trigger's width by default, and the trigger is a 28px
                icon button — which is how "porcelain · porcelain-work" became "porcelain · por…".
                One Project per section, so a row only ever carries the checkout's own name. */}
            <DropdownMenuContent align="end" className="max-h-80 w-72 overflow-y-auto">
              <DropdownMenuGroup>
                <DropdownMenuLabel>Where should it run?</DropdownMenuLabel>
                {environmentRoot !== null && (
                  <DropdownMenuItem
                    data-testid={TestIds.terminalsBoardNewAt(ENVIRONMENT_GROUP_KEY)}
                    onClick={toastingAction('New terminal', () => spawnAt(environmentRoot))}
                  >
                    <Cloud />
                    <span className="truncate">
                      {environmentName ?? daemon.host ?? 'Environment'}
                    </span>
                  </DropdownMenuItem>
                )}
                {canSpawnLocal && (
                  <DropdownMenuItem
                    data-testid={TestIds.terminalNewLocal}
                    onClick={handleSpawnLocal}
                  >
                    <Monitor />
                    This device
                  </DropdownMenuItem>
                )}
                {locations.length === 0 && environmentRoot === null && (
                  <DropdownMenuItem disabled>Add a Project first</DropdownMenuItem>
                )}
              </DropdownMenuGroup>
              {locationGroups.map((group) => (
                <DropdownMenuGroup key={group.projectId}>
                  <DropdownMenuSeparator />
                  <DropdownMenuLabel className="flex items-center gap-1.5">
                    <FolderGit2 className="size-3.5 shrink-0" aria-hidden />
                    <span className="min-w-0 truncate">{group.projectName}</span>
                  </DropdownMenuLabel>
                  {group.locations.map((location) => (
                    <DropdownMenuItem
                      key={location.key}
                      data-testid={TestIds.terminalsBoardNewAt(location.key)}
                      title={location.path}
                      onClick={toastingAction('New terminal', () => spawnAt(location.path))}
                    >
                      <GitBranch />
                      <span className="truncate">{terminalLocationLabel(location)}</span>
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuGroup>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto p-1">
          {/* The Environment leads, and its row is present even with nothing running on it:
              the multiplexer shortcuts are how a herd gets started in the first place. */}
          <div className="pb-2" data-testid={TestIds.terminalsBoardGroup(ENVIRONMENT_GROUP_KEY)}>
            <div className="flex items-center gap-1 px-2 py-1 text-[11px] text-muted-foreground">
              <span className="min-w-0 flex-1 truncate font-medium text-foreground">
                {environmentName ?? daemon.host ?? 'Environment'}
              </span>
              {ENVIRONMENT_SHELLS.map((shell) => (
                <Button
                  key={shell.key}
                  variant="ghost"
                  size="sm"
                  className="h-5 shrink-0 gap-1 px-1.5 text-2xs"
                  disabled={environmentRoot === null}
                  data-testid={TestIds.terminalsBoardEnvironmentShell(shell.key)}
                  title={`Open ${shell.label} on ${environmentName ?? daemon.host ?? 'this Environment'}`}
                  onClick={toastingAction(`Open ${shell.label}`, () =>
                    openEnvironmentShell(shell.name, shell.initialInput),
                  )}
                >
                  <Layers className="size-3" />
                  {shell.label}
                </Button>
              ))}
            </div>
            {environmentSessions.map(sessionRow)}
          </div>
          {groups
            .filter((group) => group.key !== ENVIRONMENT_GROUP_KEY)
            .map((group) => (
              <div
                key={group.key}
                className="pb-2"
                data-testid={TestIds.terminalsBoardGroup(group.key)}
              >
                <div className="px-2 py-1 text-[11px] text-muted-foreground">
                  <span className="font-medium text-foreground">{group.label}</span>
                  {group.worktreeName !== null && <span> · {group.worktreeName}</span>}
                </div>
                {group.sessions.map(sessionRow)}
              </div>
            ))}
        </div>
      </div>
      <div className="min-w-0 flex-1">
        {visible.length === 0 ? (
          <div className="flex h-full items-center justify-center p-6">
            <Empty data-testid={TestIds.terminalsBoardEmpty} className="w-full max-w-sm">
              <EmptyMedia>
                <SquareTerminal />
              </EmptyMedia>
              <EmptyHeader>
                <EmptyTitle>No terminals running</EmptyTitle>
                <EmptyDescription>Open one with + and pick where it should run.</EmptyDescription>
              </EmptyHeader>
            </Empty>
          </div>
        ) : (
          <div
            className={cn(
              'grid h-full min-h-0 gap-px bg-border',
              visible.length > 1 ? 'grid-cols-2' : 'grid-cols-1',
              visible.length > 2 ? 'grid-rows-2' : 'grid-rows-1',
            )}
          >
            {visible.map((session) => (
              <div key={session.id} className="min-h-0 min-w-0 bg-background">
                <TerminalView sessionId={session.id} />
              </div>
            ))}
          </div>
        )}
      </div>
      {renaming && (
        <TerminalRenameDialog
          key={renaming.id}
          initialName={renaming.name}
          onRename={(name: string): void => {
            renameTerminal(renaming.id, name)
            settleBackground(refreshRoster(), 'fallback')
          }}
          onClose={() => setRenaming(null)}
        />
      )}
      {mappingMode !== null && project !== null && (
        <LocalPathDialog
          key={`${mappingMode}:${mappedLocalPath ?? ''}`}
          repoPath={project.path}
          initialPath={mappedLocalPath ?? null}
          mode={mappingMode}
          onSaved={(localPath: string): void => {
            if (mappingMode !== 'spawn') return
            runUserAction(
              () => spawnLocalTerminal(localPath),
              (error) => {
                toastUserActionError('Open local terminal', error)
              },
            )
          }}
          onClose={() => setMappingMode(null)}
        />
      )}
    </div>
  )
}
