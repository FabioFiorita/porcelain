import {
  groupTerminalSessions,
  type TerminalGroup,
  terminalLocations,
} from '@porcelain/client-runtime/terminal'
import { terminalSessionsQuery } from '@porcelain/client-runtime/terminal'
import type { TerminalInfo } from '@porcelain/contracts/terminal'
import { useHubInventories } from '@renderer/features/projects'
import { useDaemonIdentity } from '@renderer/hooks/use-daemon-identity'
import type { DaemonSession } from '@renderer/lib/daemon'
import {
  daemonScopeForEnvironment,
  type LiveEnvironmentSession,
  liveEnvironmentSessions,
  useEnvironmentSessionsRevision,
} from '@renderer/lib/environment-sessions'
import { registerTerminalSession } from '@renderer/lib/local-daemon'
import { useQueries, useQueryClient } from '@tanstack/react-query'
import { useEffect, useMemo } from 'react'
import { applyTerminalRecovery } from './terminal-notifications'
import { terminalSessionsQueryKey } from './terminal-query-key'
import { type TerminalStreamListeners, terminalAdapterForSession } from './terminal-stream-adapter'
import { listTerminalSessionsOnDaemon } from './terminal-transport'
import { receiveData, receiveExit, receiveScrollback } from '@renderer/lib/terminal-registry'
import { useTerminalsStore } from '@renderer/stores/terminals'
import { browseProjectDirectoriesOnDaemon } from '@renderer/features/projects'

/**
 * The shells on ONE Environment, ready to render: its name, its groups, and the session that
 * owns every write to them.
 */
export type EnvironmentTerminals = Readonly<{
  /** Daemon-announced Environment id; null before this client has learned it. */
  environmentId: string | null
  /** null = the daemon this window is bound to. */
  connectionId: string | null
  name: string
  current: boolean
  session: DaemonSession
  /** The daemon host's own home — where an Environment shell (herdr, tmux) opens. */
  root: string | null
  /** Every Worktree this Environment knows, for the "new terminal here" picker. */
  locations: ReturnType<typeof terminalLocations>
  groups: readonly TerminalGroup[]
  sessions: readonly TerminalInfo[]
}>

/** Stable identity for one live Environment session, used for query keys and React keys. */
function sourceKey(entry: LiveEnvironmentSession): string {
  return entry.connectionId ?? entry.environmentId ?? 'primary'
}

function useLiveSessions(): readonly LiveEnvironmentSession[] {
  const revision = useEnvironmentSessionsRevision()
  return useMemo(() => liveEnvironmentSessions(revision), [revision])
}

/**
 * Open one live stream per Environment and keep it open. Mounted ONCE, in AppShell.
 *
 * Exactly one subscriber per session is the rule the whole terminal stack rests on: a second
 * `receiveData` listener writes every byte to the Ghostty surface twice. This hook is that
 * subscriber for every Environment; `useTerminalRoster` keeps the one for the "This device"
 * daemon, which is not an Environment of this Hub.
 */
export function useEnvironmentTerminalStreams(): void {
  const sources = useLiveSessions()
  const queryClient = useQueryClient()
  const daemon = useDaemonIdentity()

  useEffect(() => {
    const cleanups = sources.map((entry) => {
      entry.session.start()
      const listeners: TerminalStreamListeners = {
        onData: receiveData,
        onScrollback: receiveScrollback,
        onExit: (id, exitCode): void => {
          receiveExit(id, exitCode)
          useTerminalsStore.getState().markExited(id, exitCode)
        },
        onRecovery: (recovery): void => {
          applyTerminalRecovery(recovery, {
            refetchRoster: async (): Promise<void> => {
              await queryClient.invalidateQueries({
                queryKey: terminalSessionsQueryKey(
                  daemonScopeForEnvironment(entry.environmentId, {
                    host: daemon.host,
                    version: daemon.version,
                  }),
                  terminalSessionsQuery(),
                ),
              })
            },
          })
        },
      }
      return terminalAdapterForSession(entry.session).subscribe(listeners)
    })
    return () => {
      for (const cleanup of cleanups) cleanup()
    }
  }, [daemon.host, daemon.version, queryClient, sources])
}

/**
 * Every Environment's shells, grouped the way the board renders them.
 *
 * The board used to poll one daemon — the window's — so a Beelink shell was invisible from a
 * Mac window until you switched the whole window over. Each Environment answers for its own
 * roster, its own home directory, and its own Projects, because all three are facts about
 * that machine.
 *
 * Ownership is registered here, before the board attaches: a write, resize, or kill routes by
 * `sessionForTerminal`, and an unregistered id defaults to this window's daemon — which is
 * how a keystroke meant for the Beelink lands on the Mac.
 */
export function useEnvironmentTerminals(): readonly EnvironmentTerminals[] {
  const sources = useLiveSessions()
  const daemon = useDaemonIdentity()
  const inventories = useHubInventories()

  const rosters = useQueries({
    queries: sources.map((entry) => ({
      queryKey: terminalSessionsQueryKey(
        daemonScopeForEnvironment(entry.environmentId, {
          host: daemon.host,
          version: daemon.version,
        }),
        terminalSessionsQuery(),
      ),
      queryFn: async (): Promise<readonly TerminalInfo[]> =>
        listTerminalSessionsOnDaemon(entry.client),
      refetchInterval: 5000,
    })),
  })

  // A daemon's home directory does not move while the window is open, and it is the one
  // path an Environment shell needs.
  const roots = useQueries({
    queries: sources.map((entry) => ({
      queryKey: ['environment-terminal-root', sourceKey(entry)],
      staleTime: Number.POSITIVE_INFINITY,
      queryFn: async (): Promise<string | null> =>
        (await browseProjectDirectoriesOnDaemon(entry.client, null)).path,
    })),
  })

  useEffect(() => {
    for (const [index, entry] of sources.entries()) {
      const rows = rosters[index]?.data
      if (rows === undefined) continue
      for (const row of rows) registerTerminalSession(row.id, entry.session)
    }
  }, [rosters, sources])

  return useMemo(
    () =>
      sources.map((entry, index) => {
        const inventory =
          inventories.find((source) =>
            entry.connectionId === null
              ? source.current
              : source.inventory.environment.id === entry.environmentId,
          ) ?? null
        const locations = terminalLocations(inventory?.inventory.projects ?? [])
        const root = roots[index]?.data ?? null
        const sessions = rosters[index]?.data ?? []
        return {
          environmentId: entry.environmentId,
          connectionId: entry.connectionId,
          // The Hub inventory carries the nickname the human set; the connection label is
          // what the client saved at pairing time and can be older.
          name: inventory?.inventory.environment.name ?? entry.name,
          current: entry.connectionId === null,
          session: entry.session,
          root,
          locations,
          groups: groupTerminalSessions(sessions, locations, root),
          sessions,
        }
      }),
    [inventories, rosters, roots, sources],
  )
}
