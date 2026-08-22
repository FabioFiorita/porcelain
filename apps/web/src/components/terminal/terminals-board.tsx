import type { TerminalInfo } from '@porcelain/contracts/terminal'
import {
  LocalPathDialog,
  type LocalPathDialogMode,
} from '@renderer/components/terminal/local-path-dialog'
import { TerminalRenameDialog } from '@renderer/components/terminal/terminal-rename-dialog'
import { TerminalView } from '@renderer/components/terminal/terminal-view'
import { Button } from '@renderer/components/ui/button'
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
import {
  type EnvironmentTerminals,
  groupTerminalSessions,
  invalidateEveryTerminalSessionsQuery,
  type TerminalGroup,
  terminalAdapterFor,
  terminalLocationGroups,
  terminalLocationLabel,
  useEnvironmentTerminals,
} from '@renderer/features/terminal'
import { ENVIRONMENT_GROUP_KEY } from '@porcelain/client-runtime/terminal'
import {
  type ENVIRONMENT_SHELLS,
  EnvironmentTerminalsSection,
  type TerminalRowHandlers,
} from './terminals-board-list'
import { toastingAction, toastUserActionError } from '@renderer/hooks/mutation-error'
import { useLocalDaemon, useLocalTerminalPath } from '@renderer/hooks/use-local-terminal'
import { sessionForTerminal } from '@renderer/lib/local-daemon'
import { spawnLocalTerminal, spawnTerminalOnSession } from '@renderer/lib/terminal-actions'
import { cn } from '@renderer/lib/utils'
import { useProjectSelectionStore } from '@renderer/stores/project-selection'
import { useTerminalsStore } from '@renderer/stores/terminals'
import { runUserAction, settleBackground } from '@shared/background'
import { TestIds } from '@shared/test-ids'
import { useQueryClient } from '@tanstack/react-query'
import {
  Cloud,
  FolderGit2,
  FolderPen,
  GitBranch,
  Grid2x2,
  Monitor,
  Plus,
  SquareTerminal,
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
 * EVERY Environment is listed, not just the one this window is bound to: a shell on the
 * Beelink is a fact about the Beelink, and switching the whole window to see it was the
 * previous answer. `useEnvironmentTerminals` polls each daemon and records which one owns
 * each id, so a keystroke, a rename, and a kill all reach the machine the shell is on.
 *
 * The repo-scoped `terminals` store is merged in by id: it is the only thing that can see a
 * shell this window just created, before any roster poll has caught up. This board ATTACHES
 * but never subscribes: `useEnvironmentTerminalStreams` owns the data listeners, and a second
 * `receiveData` subscriber would write every byte to the Ghostty surface twice.
 */

const MAX_GRID_PANES = 4

/** Cap the grid so a herd of shells cannot render dozens of live Ghostty surfaces at once. */
function gridSessions(groups: readonly TerminalGroup[], focusedId: string | null): TerminalInfo[] {
  const running = groups.flatMap((group) =>
    group.sessions.filter((session) => session.status === 'running'),
  )
  const focused = running.filter((session) => session.id === focusedId)
  const rest = running.filter((session) => session.id !== focusedId)
  return [...focused, ...rest].slice(0, MAX_GRID_PANES)
}

/** Re-group after pending rows and dismissals change what this board is actually showing. */
function regroup(
  environment: EnvironmentTerminals,
  sessions: readonly TerminalInfo[],
): readonly TerminalGroup[] {
  return groupTerminalSessions(sessions, environment.locations, environment.root)
}

export function TerminalsBoard(): React.JSX.Element {
  const queryClient = useQueryClient()
  const environments = useEnvironmentTerminals()
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

  // Rows the daemons have not listed yet: a shell this window created moments ago. Held by
  // the store until the Environment that owns it says so (`freshCreates` in stores/terminals).
  const rosterSessions = useMemo<TerminalInfo[]>(() => {
    const byId = new Map<string, TerminalInfo>()
    for (const environment of environments) {
      for (const session of environment.sessions) byId.set(session.id, session)
    }
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
  }, [environments, storeRows])

  const listed = useMemo<readonly EnvironmentTerminals[]>(
    () =>
      environments.map((environment) => {
        // A row no daemon has listed yet belongs to whichever Environment owns its session —
        // that is how a "This device" shell lands on This device's block rather than on the
        // machine this window happens to be bound to. Unknown ids fall back to the current
        // Environment, which is where a spawn with no explicit target went.
        const pending = storeRows.filter((row) => {
          if (environments.some((source) => source.sessions.some((s) => s.id === row.id))) {
            return false
          }
          const owner = sessionForTerminal(row.id)
          const owned = environments.find((source) => source.session === owner)
          return owned === undefined ? environment.current : owned === environment
        })
        const visibleSessions = [...environment.sessions, ...pending].filter(
          (session) => !dismissed.has(session.id),
        )
        return {
          ...environment,
          sessions: visibleSessions,
          groups: regroup(environment, visibleSessions),
        }
      }),
    [dismissed, environments, storeRows],
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

  const groups = useMemo(() => listed.flatMap((environment) => environment.groups), [listed])
  const sessions = useMemo(() => groups.flatMap((group) => group.sessions), [groups])
  const canGrid = sessions.filter((session) => session.status === 'running').length > 1
  const visible = useMemo(() => {
    if (grid) return gridSessions(groups, focusedId)
    const focused = sessions.find((session) => session.id === focusedId)
    return focused === undefined ? [] : [focused]
  }, [focusedId, grid, groups, sessions])

  // Follow the roster: land on the first session, and don't strand the board on a killed one.
  // Safe to reconcile eagerly because a just-created row is held in the store until a roster
  // that could actually know about it arrives (`freshCreates` in stores/terminals.ts).
  useEffect(() => {
    // Not while every roster is cold: after `gcTime` this board remounts with no data and
    // would immediately un-focus the session the human was watching.
    const cold = environments.every((environment) => environment.sessions.length === 0)
    if (cold && storeRows.length === 0) return
    if (focusedId !== null && sessions.some((session) => session.id === focusedId)) return
    focus(sessions[0]?.id ?? null)
  }, [environments, focus, focusedId, sessions, storeRows.length])

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
    await invalidateEveryTerminalSessionsQuery(queryClient)
  }

  /**
   * Spawn through the shared roster action, not straight at the adapter: `revealTerminal` is
   * then the single place a new shell is put in front of the human, whether it started here,
   * from a saved Action, or from a Worktree lifecycle script. The Environment is named, so
   * the shell starts on the machine whose row was clicked.
   */
  const spawnOn = async (
    environment: EnvironmentTerminals,
    cwd: string,
    opts?: { name?: string; initialInput?: string },
  ): Promise<void> => {
    await spawnTerminalOnSession(environment.session, cwd, opts)
    await refreshRoster()
  }

  /** Find that Environment's shell by name before starting a second one. */
  const openEnvironmentShell = async (
    environment: EnvironmentTerminals,
    shell: (typeof ENVIRONMENT_SHELLS)[number],
  ): Promise<void> => {
    const existing = environment.sessions.find(
      (session) => session.name === shell.name && session.status === 'running',
    )
    if (existing !== undefined) {
      focus(existing.id)
      return
    }
    if (environment.root === null) return
    await spawnOn(environment, environment.root, {
      name: shell.name,
      initialInput: shell.initialInput,
    })
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

  const handlers: TerminalRowHandlers = {
    focusedId,
    localIds: localOrigins,
    onFocus: focus,
    onClose: handleClose,
    onRename: setRenaming,
    onOpenShell: (environment, shell) => {
      settleBackground(openEnvironmentShell(environment, shell), 'fallback')
    },
  }

  return (
    <div className="flex h-full min-h-0" data-testid={TestIds.terminalsBoard}>
      <div className="flex w-64 min-w-0 shrink-0 flex-col border-r">
        <div className="flex h-9 shrink-0 items-center gap-1 border-b px-2">
          <span className="min-w-0 flex-1 truncate text-xs font-medium">Terminals</span>
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
            <DropdownMenuContent align="end" className="max-h-80 w-72 overflow-y-auto">
              <DropdownMenuGroup>
                <DropdownMenuLabel>Where should it run?</DropdownMenuLabel>
                {canSpawnLocal && (
                  <DropdownMenuItem
                    data-testid={TestIds.terminalNewLocal}
                    onClick={handleSpawnLocal}
                  >
                    <Monitor />
                    This device
                  </DropdownMenuItem>
                )}
              </DropdownMenuGroup>
              {listed.map((environment) => (
                <DropdownMenuGroup key={environment.environmentId ?? 'current'}>
                  <DropdownMenuSeparator />
                  <DropdownMenuLabel className="text-2xs text-muted-foreground">
                    {environment.name}
                  </DropdownMenuLabel>
                  {environment.root !== null && (
                    <DropdownMenuItem
                      data-testid={TestIds.terminalsBoardNewAt(
                        `${environment.environmentId ?? 'current'}:${ENVIRONMENT_GROUP_KEY}`,
                      )}
                      onClick={toastingAction('New terminal', () =>
                        spawnOn(environment, environment.root ?? ''),
                      )}
                    >
                      <Cloud />
                      <span className="truncate">{environment.name}</span>
                    </DropdownMenuItem>
                  )}
                  {terminalLocationGroups(environment.locations).map((group) => (
                    <DropdownMenuGroup
                      key={`${environment.environmentId ?? 'current'}:${group.projectId}`}
                    >
                      <DropdownMenuLabel className="flex items-center gap-1.5">
                        <FolderGit2 className="size-3.5 shrink-0" aria-hidden />
                        <span className="min-w-0 truncate">{group.projectName}</span>
                      </DropdownMenuLabel>
                      {group.locations.map((location) => (
                        <DropdownMenuItem
                          key={location.key}
                          data-testid={TestIds.terminalsBoardNewAt(location.key)}
                          title={location.path}
                          onClick={toastingAction('New terminal', () =>
                            spawnOn(environment, location.path),
                          )}
                        >
                          <GitBranch />
                          <span className="truncate">{terminalLocationLabel(location)}</span>
                        </DropdownMenuItem>
                      ))}
                    </DropdownMenuGroup>
                  ))}
                </DropdownMenuGroup>
              ))}
              {listed.length === 0 && (
                <DropdownMenuItem disabled>Add a Project first</DropdownMenuItem>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto p-1">
          {listed.map((environment) => (
            <EnvironmentTerminalsSection
              key={environment.environmentId ?? 'current'}
              environment={environment}
              handlers={handlers}
            />
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
