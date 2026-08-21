import { terminalSessionsQuery } from '@porcelain/client-runtime/terminal'
import type { TerminalSessionsOutput } from '@porcelain/contracts/terminal'
import { keepPreviousData, useQuery, useQueryClient } from '@tanstack/react-query'
import { useEffect, useRef } from 'react'
import { isPaired, useActiveEnvironment } from '@/features/remote'
import { getDaemonClient } from '@/lib/daemon/client'
import { DaemonError } from '@/lib/daemon/errors'
import { callDaemon } from '@/lib/daemon/procedure'
import { receiveData, receiveExit, receiveScrollback } from './terminal-engine'
import { renameTerminalProcedure, terminalSessionsProcedure } from './terminal-procedures'
import { invalidateTerminalSessionsQueries, terminalSessionsQueryKey } from './terminal-query-key'
import { useMobileTerminalRecovery } from './terminal-recovery'
import { TERMINAL_ROSTER_POLL_MS } from './terminal-roster-policy'
import { type TerminalSession, useTerminalStore } from './terminal-store'
import { type TerminalStreamListeners, useMobileTerminalStream } from './terminal-stream-adapter'

const NATIVE_STREAM_LISTENERS: TerminalStreamListeners = {
  onData: receiveData,
  onExit: (id, exitCode) => {
    receiveExit(id, exitCode)
    useTerminalStore.getState().markExited(id, exitCode)
  },
  onScrollback: receiveScrollback,
}

/** Keep one engine listener while the roster and a pushed session route overlap. */
export function useTerminalStream(): void {
  useMobileTerminalStream(NATIVE_STREAM_LISTENERS)
}

/**
 * Query-backed Terminal roster plus the one shared native stream binding. The daemon owns names,
 * cwd, status, and exit code; the store owns only tombstones and the optimistic new row.
 *
 * DAEMON-WIDE, and gated on pairing alone rather than on a selected checkout: the Terminals tab
 * leads with the Environment's own shells, which exist before any Project is open. Grouping the
 * flat list back into Projects is `groupTerminalSessions`, not a filter here.
 *
 * It reads and never ATTACHES. Attaching is per-session work the viewer does when it opens one
 * (`terminal-session-screen.tsx`): a herd of agent shells on the daemon would otherwise mean a
 * dozen emulators replaying scrollback into a phone that is showing none of them.
 */
export function useTerminals(active: boolean): {
  sessions: TerminalSession[]
  isLoading: boolean
  error: DaemonError | null
} {
  const environment = useActiveEnvironment()
  const environmentId = environment?.id ?? 'none'
  const hydrate = useTerminalStore((state) => state.hydrate)
  const reset = useTerminalStore((state) => state.reset)
  const sessions = useTerminalStore((state) => state.sessions)
  const enabled = active && isPaired(environment)

  useTerminalStream()

  const { data, error, isLoading, refetch } = useQuery<TerminalSessionsOutput, DaemonError>({
    enabled,
    placeholderData: keepPreviousData,
    queryFn: async (): Promise<TerminalSessionsOutput> => {
      if (!isPaired(environment)) {
        throw new DaemonError(
          'unreachable',
          'terminalSessions',
          'No daemon is paired with this device.',
        )
      }
      return callDaemon(getDaemonClient(environment), terminalSessionsProcedure, undefined)
    },
    queryKey: terminalSessionsQueryKey(environmentId, terminalSessionsQuery()),
    refetchInterval: TERMINAL_ROSTER_POLL_MS,
    staleTime: 0,
  })
  useMobileTerminalRecovery(active, refetch)

  useEffect(() => {
    if (data === undefined) return
    hydrate([...data])
  }, [data, hydrate])

  // A session id means something on ONE daemon. Switching Environment — or losing the pairing
  // that made this one reachable — makes every row and every emulator stale, and the checkout
  // switch that used to clear them is gone now that the roster is daemon-wide. Compared against
  // the last value rather than declared as effect cleanup: unmounting this screen must NOT let
  // go of the sessions, which is the whole reason a shell survives leaving the tab.
  const lastEnvironmentId = useRef(environmentId)
  useEffect(() => {
    if (lastEnvironmentId.current === environmentId && isPaired(environment)) return
    lastEnvironmentId.current = environmentId
    reset()
  }, [environment, environmentId, reset])

  return { error, isLoading, sessions }
}

/**
 * Re-read the roster now.
 *
 * A spawn or a kill changes the daemon's list immediately, and the five-second poll is a
 * backstop for what OTHER clients do — waiting it out makes this device's own action look
 * like it did not land.
 */
export function useRefreshTerminals(): () => Promise<void> {
  const environment = useActiveEnvironment()
  const queryClient = useQueryClient()

  return async (): Promise<void> => {
    if (!isPaired(environment)) return
    await invalidateTerminalSessionsQueries(queryClient, environment.id)
  }
}

/** Write a rename through to the daemon, which owns the roster label. */
export function useRenameTerminal(): (id: string, name: string) => Promise<void> {
  const rename = useTerminalStore((state) => state.rename)
  const environment = useActiveEnvironment()
  const queryClient = useQueryClient()

  return async (id: string, name: string): Promise<void> => {
    const trimmed = name.trim()
    if (trimmed === '') return
    rename(id, trimmed)
    if (!isPaired(environment)) return
    await callDaemon(getDaemonClient(environment), renameTerminalProcedure, {
      id,
      name: trimmed,
    })
    await invalidateTerminalSessionsQueries(queryClient, environment.id)
  }
}
