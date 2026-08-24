import {
  daemonScopeForEnvironment,
  liveEnvironmentSessions,
  useEnvironmentSessionsRevision,
} from '@renderer/lib/environment-sessions'
import { receiveData, receiveExit, receiveScrollback } from '@renderer/lib/terminal-registry'
import { useTerminalsStore } from '@renderer/stores/terminals'
import { useQueryClient } from '@tanstack/react-query'
import { useEffect, useMemo } from 'react'
import { applyTerminalRecovery } from './terminal-notifications'
import { terminalSessionsQueryKey } from './terminal-query-key'
import { terminalSessionsQuery } from '@porcelain/client-runtime/terminal'
import { useDaemonIdentity } from '@renderer/hooks/use-daemon-identity'
import { terminalAdapterForSession, type TerminalStreamListeners } from './terminal-stream-adapter'

/**
 * Open one live stream per Environment and keep it open. Mounted ONCE, in AppShell.
 *
 * Exactly one subscriber per session is the rule the whole terminal stack rests on: a second
 * `receiveData` listener writes every byte to the Ghostty surface twice. This hook is that
 * subscriber for every Environment; `useTerminalRoster` keeps the one for the "This device"
 * daemon, which is not an Environment of this Hub.
 */
export function useEnvironmentTerminalStreams(): void {
  const revision = useEnvironmentSessionsRevision()
  const sources = useMemo(() => liveEnvironmentSessions(revision), [revision])
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
