import { terminalSessionsQuery } from '@porcelain/client-runtime/terminal'
import { useDaemonIdentity } from '@renderer/hooks/use-daemon-identity'
import {
  useLocalDaemon,
  useLocalTerminalPath,
  useLocalTerminalSessions,
} from '@renderer/hooks/use-local-terminal'
import { type DaemonSession, primary } from '@renderer/lib/daemon'
import type { DaemonScope } from '@renderer/lib/daemon-scope'
import { environmentClientFor } from '@renderer/lib/environment-sessions'
import {
  localDaemonSession,
  markLocalTerminal,
  registerTerminalSession,
} from '@renderer/lib/local-daemon'
import { followTerminal } from '@renderer/lib/terminal-actions'
import { receiveData, receiveExit, receiveScrollback } from '@renderer/lib/terminal-registry'
import { trpc } from '@renderer/lib/trpc'
import { useHubRepoPath } from '@renderer/stores/hub-repo'
import { useHubTarget } from '@renderer/stores/hub-selection'
import { type TerminalSession, useTerminalsStore } from '@renderer/stores/terminals'
import { settleBackground } from '@shared/background'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useEffect, useMemo, useState } from 'react'
import { applyTerminalRecovery } from './terminal-notifications'
import { terminalSessionsQueryKey } from './terminal-query-key'
import {
  type TerminalStreamListeners,
  terminalAdapterForSession,
  useTerminalStream,
} from './terminal-stream-adapter'
import { listTerminalSessionsOnDaemon } from './terminal-transport'

/** The local endpoint is installed by useLocalDaemon's effect; resolve it after that effect runs. */
function useResolvedLocalSession(localPath: string | null): DaemonSession | null {
  const [session, setSession] = useState<DaemonSession | null>(() =>
    localPath === null ? null : localDaemonSession(),
  )

  useEffect(() => {
    if (localPath === null) {
      setSession(null)
      return
    }
    const next = localDaemonSession()
    if (next !== null) setSession(next)
  }, [localPath])

  return session
}

/**
 * Terminal stream subscriptions plus authoritative primary/local roster hydration. The daemon
 * owns rows and the shared stream adapter owns attachment/recovery; this hook only binds those
 * boundaries to the Web registry and roster store.
 */
export function useTerminalRoster(): void {
  const markExited = useTerminalsStore((state) => state.markExited)
  const hydrate = useTerminalsStore((state) => state.hydrate)
  const repoPath = useHubRepoPath()
  const target = useHubTarget()
  const daemon = useDaemonIdentity()
  const utils = trpc.useUtils()
  const owner =
    target === null && repoPath !== null
      ? { client: utils.client, session: primary }
      : environmentClientFor(target?.environmentId ?? null, utils.client)
  const daemonScope: DaemonScope = {
    host: target?.environmentId ?? daemon.host,
    version: daemon.version,
  }
  const ownerRoster = useQuery({
    queryKey: terminalSessionsQueryKey(daemonScope, terminalSessionsQuery()),
    queryFn: async () => {
      if (owner === null) throw new Error('The target Environment is offline.')
      return listTerminalSessionsOnDaemon(owner.client)
    },
    enabled: repoPath !== null && owner !== null,
    refetchInterval: 5000,
  })
  const queryClient = useQueryClient()

  const localDaemonState = useLocalDaemon()
  // A This-device shell is the companion to a REMOTE Worktree. Keep polling that
  // local daemon while the remote target is open so its terminals survive the
  // optimistic-create window and renderer reloads.
  const localDaemon = localDaemonState?.isLocal === false ? localDaemonState : null
  const mappedPath = useLocalTerminalPath(repoPath)
  const localPath = localDaemon?.isLocal === false ? (mappedPath ?? null) : null
  const localSessions = useLocalTerminalSessions(localPath)
  const localSession = useResolvedLocalSession(localPath)

  const localListeners = useMemo<TerminalStreamListeners>(
    () => ({
      onData: receiveData,
      onScrollback: receiveScrollback,
      onExit: (id, exitCode): void => {
        receiveExit(id, exitCode)
        markExited(id, exitCode)
      },
      onRecovery: (recovery): void => {
        applyTerminalRecovery(recovery, {
          refetchRoster: () =>
            queryClient.invalidateQueries({ queryKey: ['local-terminal-sessions', localPath] }),
        })
      },
    }),
    [localPath, markExited, queryClient],
  )

  const ownerSession = owner === null ? null : (owner.session ?? primary)
  // No subscription for the Environment session: `useEnvironmentTerminalStreams` is the ONE
  // subscriber for every Environment, and a second `receiveData` listener would write each
  // byte to the Ghostty surface twice. The adapter is still needed here to ATTACH the
  // checkout's own shells. "This device" is not an Environment of this Hub, so its stream is
  // still owned here.
  const ownerAdapter = useMemo(
    () => (ownerSession === null ? null : terminalAdapterForSession(ownerSession)),
    [ownerSession],
  )
  const localAdapter = useTerminalStream(localSession, localListeners)

  /**
   * A Worktree lifecycle terminal the daemon just started for us.
   *
   * Setup and dispose are the two commands Porcelain runs without a click, so the panel
   * follows them — but it does not open: nobody asked for this shell, and sliding it over
   * a diff is a worse surprise than a missed script. The id is held until the row actually
   * shows up: creating a Worktree announces the session before the client has opened that
   * checkout, and the roster only lists terminals of the open one.
   */
  const [pendingFocus, setPendingFocus] = useState<string | null>(null)
  useEffect(() => {
    if (ownerSession === null) return
    return ownerSession.onChange((change) => {
      if (change.kind !== 'terminal.worktree-script-started') return
      setPendingFocus(change.terminalId)
      settleBackground(ownerRoster.refetch(), 'notification')
    })
  }, [ownerSession, ownerRoster.refetch])

  useEffect(() => {
    if (repoPath === null || ownerRoster.data === undefined) return
    const inRepo = ownerRoster.data.filter(
      (session) => session.cwd === repoPath || session.cwd.startsWith(`${repoPath}/`),
    )
    const rows: TerminalSession[] = [
      ...inRepo.map((session) => ({
        id: session.id,
        name: session.name,
        cwd: session.cwd,
        createdAt: session.createdAt,
        status: session.status,
        exitCode: session.exitCode,
        origin: 'primary' as const,
      })),
      ...localSessions.map((session) => ({
        id: session.id,
        name: session.name,
        cwd: session.cwd,
        createdAt: session.createdAt,
        status: session.status,
        exitCode: session.exitCode,
        origin: 'local' as const,
      })),
    ]

    if (pendingFocus !== null && rows.some((row) => row.id === pendingFocus)) {
      setPendingFocus(null)
      followTerminal(pendingFocus)
    }

    // Additive, never a wipe: this hook knows the OPEN checkout's shells. Clearing the
    // map here dropped ownership of a shell on another Environment and sent the next
    // keystroke to this window's daemon.
    if (ownerSession !== null) {
      for (const session of inRepo) registerTerminalSession(session.id, ownerSession)
    }
    for (const session of localSessions) markLocalTerminal(session.id)
    hydrate(rows)

    for (const session of inRepo) {
      if (ownerAdapter === null || ownerAdapter.isTerminalAttached(session.id)) continue
      settleBackground(ownerAdapter.attachTerminal(session.id), 'lifecycle')
    }
    if (localAdapter === null) return
    for (const session of localSessions) {
      if (localAdapter.isTerminalAttached(session.id)) continue
      settleBackground(localAdapter.attachTerminal(session.id), 'lifecycle')
    }
  }, [
    hydrate,
    localAdapter,
    localSessions,
    ownerAdapter,
    ownerRoster.data,
    ownerSession,
    pendingFocus,
    repoPath,
  ])
}
