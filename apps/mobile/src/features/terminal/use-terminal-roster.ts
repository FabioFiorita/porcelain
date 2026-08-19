import { terminalSessionsQuery } from '@porcelain/client-runtime/terminal'
import type { TerminalSessionsOutput } from '@porcelain/contracts/terminal'
import { settleBackground } from '@porcelain/shared/background'
import { keepPreviousData, useQuery, useQueryClient } from '@tanstack/react-query'
import { useEffect, useMemo } from 'react'
import { useHubRepoPath } from '@/features/projects'
import { isPaired, useActiveEnvironment } from '@/features/remote'
import { getDaemonClient } from '@/lib/daemon/client'
import { DaemonError } from '@/lib/daemon/errors'
import { callDaemon } from '@/lib/daemon/procedure'
import { receiveData, receiveExit, receiveScrollback } from './terminal-engine'
import { renameTerminalProcedure, terminalSessionsProcedure } from './terminal-procedures'
import { invalidateTerminalSessionsQueries, terminalSessionsQueryKey } from './terminal-query-key'
import { useMobileTerminalRecovery } from './terminal-recovery'
import { TERMINAL_ROSTER_POLL_MS, terminalSessionsForRepo } from './terminal-roster-policy'
import { type TerminalSession, useTerminalStore } from './terminal-store'
import {
  mobileTerminalAdapter,
  type TerminalStreamListeners,
  useMobileTerminalStream,
} from './terminal-stream-adapter'

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
 * cwd, status, and exit code; the store owns only selection, tombstones, and native presentation
 * workflow.
 */
export function useTerminals(active: boolean): {
  sessions: TerminalSession[]
  isLoading: boolean
  error: DaemonError | null
} {
  const environment = useActiveEnvironment()
  const environmentId = environment?.id ?? 'none'
  const repoPath = useHubRepoPath() ?? ''
  const hydrate = useTerminalStore((state) => state.hydrate)
  const reset = useTerminalStore((state) => state.reset)
  const sessions = useTerminalStore((state) => state.sessions)
  const adapter = mobileTerminalAdapter()
  const enabled = active && repoPath !== '' && isPaired(environment)

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
  useMobileTerminalRecovery(active && repoPath !== '', refetch)

  // The daemon lists every PTY it owns, across repos. This client shows one project at a time.
  const inRepo = useMemo(() => terminalSessionsForRepo(data ?? [], repoPath), [data, repoPath])

  useEffect(() => {
    if (repoPath === '') {
      reset()
      return
    }
    if (data === undefined) return
    hydrate(
      inRepo.map((session) => ({
        exitCode: session.exitCode,
        id: session.id,
        name: session.name,
        status: session.status,
      })),
    )
    for (const session of inRepo) {
      if (adapter.isTerminalAttached(session.id)) continue
      // A dropped socket leaves desired state awaiting reattach; the shared adapter owns retry.
      settleBackground(adapter.attachTerminal(session.id), 'lifecycle')
    }
  }, [adapter, data, hydrate, inRepo, repoPath, reset])

  return { error, isLoading, sessions }
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
