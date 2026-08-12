import {
  useLocalDaemon,
  useLocalTerminalPath,
  useLocalTerminalSessions,
} from '@renderer/hooks/use-local-terminal'
import { type DaemonSession, primary } from '@renderer/lib/daemon'
import { localDaemonSession, markLocalTerminal } from '@renderer/lib/local-daemon'
import { receiveData, receiveExit, receiveScrollback } from '@renderer/lib/terminal-registry'
import { trpc } from '@renderer/lib/trpc'
import { useProjectSelectionStore } from '@renderer/stores/project-selection'
import { type TerminalSession, useTerminalsStore } from '@renderer/stores/terminals'
import { settleBackground } from '@shared/background'
import { useQueryClient } from '@tanstack/react-query'
import { useEffect, useMemo, useState } from 'react'
import { applyTerminalRecovery } from './terminal-notifications'
import { type TerminalStreamListeners, useTerminalStream } from './terminal-stream-adapter'

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
  const repoPath = useProjectSelectionStore((state) => state.project?.path ?? null)
  const primaryRoster = trpc.terminalSessions.useQuery(undefined, {
    enabled: repoPath !== null,
    refetchInterval: 5000,
  })
  const queryClient = useQueryClient()

  const localDaemon = useLocalDaemon()
  const mappedPath = useLocalTerminalPath(repoPath)
  const localPath = localDaemon?.isLocal === false ? (mappedPath ?? null) : null
  const localSessions = useLocalTerminalSessions(localPath)
  const localSession = useResolvedLocalSession(localPath)

  const primaryListeners = useMemo<TerminalStreamListeners>(
    () => ({
      onData: receiveData,
      onScrollback: receiveScrollback,
      onExit: (id, exitCode): void => {
        receiveExit(id, exitCode)
        markExited(id, exitCode)
      },
      onRecovery: (recovery): void => {
        applyTerminalRecovery(recovery, {
          refetchRoster: () => primaryRoster.refetch(),
        })
      },
    }),
    [markExited, primaryRoster.refetch],
  )
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

  const primaryAdapter = useTerminalStream(primary, primaryListeners)
  const localAdapter = useTerminalStream(localSession, localListeners)

  useEffect(() => {
    if (repoPath === null || primaryRoster.data === undefined) return
    const inRepo = primaryRoster.data.filter(
      (session) => session.cwd === repoPath || session.cwd.startsWith(`${repoPath}/`),
    )
    const rows: TerminalSession[] = [
      ...inRepo.map((session) => ({
        id: session.id,
        name: session.name,
        status: session.status,
        exitCode: session.exitCode,
        origin: 'primary' as const,
      })),
      ...localSessions.map((session) => ({
        id: session.id,
        name: session.name,
        status: session.status,
        exitCode: session.exitCode,
        origin: 'local' as const,
      })),
    ]

    for (const session of localSessions) markLocalTerminal(session.id)
    hydrate(rows)

    for (const session of inRepo) {
      if (primaryAdapter === null || primaryAdapter.isTerminalAttached(session.id)) continue
      settleBackground(primaryAdapter.attachTerminal(session.id), 'lifecycle')
    }
    if (localAdapter === null) return
    for (const session of localSessions) {
      if (localAdapter.isTerminalAttached(session.id)) continue
      settleBackground(localAdapter.attachTerminal(session.id), 'lifecycle')
    }
  }, [hydrate, localAdapter, localSessions, primaryAdapter, primaryRoster.data, repoPath])
}
