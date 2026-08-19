import { terminalSessionsQuery } from '@porcelain/client-runtime/terminal'
import type { TerminalInfo } from '@porcelain/contracts/terminal'
import { TerminalView } from '@renderer/components/terminal/terminal-view'
import { Button } from '@renderer/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@renderer/components/ui/dropdown-menu'
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from '@renderer/components/ui/empty'
import { useHubInventory } from '@renderer/features/projects'
import { toastingAction } from '@renderer/hooks/mutation-error'
import { useDaemonIdentity } from '@renderer/hooks/use-daemon-identity'
import { primary } from '@renderer/lib/daemon'
import { nextTerminalNumber } from '@renderer/lib/terminal-actions'
import { trpc } from '@renderer/lib/trpc'
import { cn } from '@renderer/lib/utils'
import { settleBackground } from '@shared/background'
import { TestIds } from '@shared/test-ids'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Grid2x2, Plus, SquareTerminal } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import {
  groupTerminalSessions,
  listTerminalSessionsOnDaemon,
  type TerminalGroup,
  terminalAdapterForSession,
  terminalLocations,
  terminalSessionsQueryKey,
} from '@renderer/features/terminal'

/**
 * The daemon-wide Terminals board: every live shell on this daemon, grouped by the
 * Project/Worktree its cwd falls in, with one of them (or up to four, in Grid) shown here
 * in the Viewer. It is the terminal analogue of the Tasks board — deliberately NOT scoped
 * to the Hub selection, so a long-lived process (a multiplexer, a watcher, an agent herd)
 * stays reachable while you review a different Project.
 *
 * The daemon owns the sessions, so the list survives a reload; which one this board shows
 * is client state and does not. It reads the same daemon-global roster query as the bottom
 * panel — the panel narrows it to the open repo, this board does not — and it never writes
 * to the repo-scoped `terminals` store, so panel behaviour and session ownership are
 * untouched. ADR 0005 ("terminals live only in the bottom panel") is superseded for this
 * board only: there is still no per-terminal tab kind, and this store boundary still holds.
 *
 * Scope: primary-daemon sessions. Secondary Environments and "This device" (`local`
 * origin) shells are reachable only through their repo-scoped panel today.
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

export function TerminalsBoard(): React.JSX.Element {
  const daemon = useDaemonIdentity()
  const client = trpc.useUtils().client
  const queryClient = useQueryClient()
  const inventory = useHubInventory()
  const [focusedId, setFocusedId] = useState<string | null>(null)
  const [grid, setGrid] = useState(false)

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

  const locations = useMemo(
    () => terminalLocations(inventory?.projects ?? []),
    [inventory?.projects],
  )
  const groups = useMemo(
    () => groupTerminalSessions(sessionsQuery.data ?? [], locations),
    [locations, sessionsQuery.data],
  )
  const sessions = useMemo(() => groups.flatMap((group) => group.sessions), [groups])
  const visible = useMemo(() => {
    if (grid) return gridSessions(groups, focusedId)
    const focused = sessions.find((session) => session.id === focusedId)
    return focused === undefined ? [] : [focused]
  }, [focusedId, grid, groups, sessions])

  // Follow the roster: land on the first session, and don't strand the board on a killed one.
  useEffect(() => {
    if (focusedId !== null && sessions.some((session) => session.id === focusedId)) return
    setFocusedId(sessions[0]?.id ?? null)
  }, [focusedId, sessions])

  // Attach only what is on screen. The PTY is already streaming to this daemon session; the
  // app-wide roster subscription owns the data listeners, so attaching here just replays
  // scrollback into the registry. Never subscribe listeners from this board — a second
  // `receiveData` subscriber would write every byte to the Ghostty surface twice.
  useEffect(() => {
    const adapter = terminalAdapterForSession(primary)
    for (const session of visible) {
      if (adapter.isTerminalAttached(session.id)) continue
      settleBackground(adapter.attachTerminal(session.id), 'lifecycle')
    }
  }, [visible])

  const spawnAt = async (cwd: string): Promise<void> => {
    const name = `Terminal ${nextTerminalNumber(
      sessions.map((session) => session.name),
      0,
    )}`
    const id = await terminalAdapterForSession(primary).createTerminal({ cwd, name })
    setFocusedId(id)
    await queryClient.invalidateQueries({ queryKey: sessionsKey })
  }

  return (
    <div className="flex h-full min-h-0" data-testid={TestIds.terminalsBoard}>
      <div className="flex w-60 min-w-0 shrink-0 flex-col border-r">
        <div className="flex h-9 shrink-0 items-center gap-1 border-b px-2">
          <span className="min-w-0 flex-1 truncate text-xs font-medium">Terminals</span>
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
          <DropdownMenu>
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
            <DropdownMenuContent align="end" className="max-h-80 overflow-y-auto">
              {locations.length === 0 && (
                <DropdownMenuItem disabled>Add a Project first</DropdownMenuItem>
              )}
              {locations.map((location) => (
                <DropdownMenuItem
                  key={location.key}
                  data-testid={TestIds.terminalsBoardNewAt(location.key)}
                  onClick={toastingAction('New terminal', () => spawnAt(location.path))}
                >
                  <span className="truncate">
                    {location.projectName} · {location.worktreeName}
                  </span>
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto p-1">
          {groups.map((group) => (
            <div
              key={group.key}
              className="pb-2"
              data-testid={TestIds.terminalsBoardGroup(group.key)}
            >
              <div className="px-2 py-1 text-[11px] text-muted-foreground">
                <span className="font-medium text-foreground">{group.label}</span>
                {group.worktreeName !== null && <span> · {group.worktreeName}</span>}
              </div>
              {group.sessions.map((session) => (
                <button
                  key={session.id}
                  type="button"
                  data-testid={TestIds.terminalsBoardSession(session.id)}
                  aria-current={session.id === focusedId ? 'true' : undefined}
                  className={cn(
                    'flex h-7 w-full min-w-0 items-center gap-2 rounded-md px-2 text-left text-xs',
                    session.id === focusedId
                      ? 'bg-accent text-accent-foreground'
                      : 'text-muted-foreground hover:bg-accent/50',
                  )}
                  onClick={() => setFocusedId(session.id)}
                >
                  <SquareTerminal className="size-3.5 shrink-0" />
                  <span className="min-w-0 flex-1 truncate">{session.name}</span>
                  {session.status === 'exited' && <span className="shrink-0">exited</span>}
                </button>
              ))}
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
                <EmptyDescription>
                  Open one with + and pick the Project it should run in.
                </EmptyDescription>
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
    </div>
  )
}
