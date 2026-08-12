import type { ActionView } from '@porcelain/contracts/actions'
import { settleBackground } from '@porcelain/shared/background'
import { useEffect, useMemo } from 'react'
import { useActiveProject } from '@/features/projects'
import type { DaemonError } from '@/lib/daemon/errors'
import {
  actionsQuery,
  renameTerminalMutation,
  terminalSessionsQuery,
  trustActionsMutation,
} from '@/lib/daemon/procedures/terminal'
import { useDaemonMutation, useDaemonQuery } from '@/lib/daemon/queries'
import { receiveData, receiveExit, receiveScrollback } from './terminal-engine'
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
  const project = useActiveProject()
  const repoPath = project?.path ?? ''
  const hydrate = useTerminalStore((state) => state.hydrate)
  const reset = useTerminalStore((state) => state.reset)
  const sessions = useTerminalStore((state) => state.sessions)
  const adapter = mobileTerminalAdapter()

  useTerminalStream()

  const { data, error, isLoading, refetch } = useDaemonQuery(terminalSessionsQuery, undefined, {
    enabled: active && project !== null,
    placeholderData: 'keepPreviousData',
    pollMs: TERMINAL_ROSTER_POLL_MS,
    staleTime: 0,
  })
  useMobileTerminalRecovery(active && project !== null, refetch)

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
  const mutation = useDaemonMutation(renameTerminalMutation, {
    invalidates: ['terminalSessions'],
  })

  return async (id: string, name: string): Promise<void> => {
    const trimmed = name.trim()
    if (trimmed === '') return
    rename(id, trimmed)
    await mutation.mutateAsync({ id, name: trimmed })
  }
}

/** The project's saved actions — the agent curates them; running one is human-only. */
export function useTerminalActions(active: boolean): {
  actions: ActionView[]
  error: DaemonError | null
} {
  const project = useActiveProject()
  const { data, error } = useDaemonQuery(actionsQuery, project?.path ?? '', {
    enabled: active && project !== null,
  })
  // A phone has no local daemon, so local-only actions are not runnable here.
  const actions = useMemo(() => (data ?? []).filter((action) => action.where !== 'local'), [data])
  return { actions, error }
}

/** Accept a command this daemon's machine has not run before. */
export function useTrustAction(): (id: string) => Promise<void> {
  const project = useActiveProject()
  const mutation = useDaemonMutation(trustActionsMutation, { invalidates: ['actions'] })

  return async (id: string): Promise<void> => {
    if (project === null) return
    await mutation.mutateAsync({ ids: [id], repoPath: project.path })
  }
}
