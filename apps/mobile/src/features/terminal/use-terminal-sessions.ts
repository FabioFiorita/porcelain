import type { UseQueryResult } from '@tanstack/react-query'
import { useQueryClient } from '@tanstack/react-query'
import { useIsFocused } from 'expo-router'
import { useCallback, useEffect, useMemo } from 'react'
import { useActiveEnvironment } from '@/lib/daemon/environments-store'
import type { DaemonError } from '@/lib/daemon/errors'
import {
  renameTerminalMutation,
  type TerminalInfo,
  terminalSessionsQuery,
} from '@/lib/daemon/procedures/terminal'
import { daemonKeys, useDaemonMutation, useDaemonQuery } from '@/lib/daemon/queries'
import { useActiveRepo } from '@/lib/daemon/repo'
import { useDaemonSession } from '@/lib/daemon/session'

const TERMINAL_BACKSTOP_MS = 10_000

type TerminalQuery = UseQueryResult<TerminalInfo[], DaemonError>

export function useTerminalSessions(showAll: boolean): TerminalQuery & {
  sessions: TerminalInfo[]
  rename: (id: string, name: string) => Promise<void>
  kill: (id: string) => void
} {
  const focused = useIsFocused()
  const repo = useActiveRepo()
  const environment = useActiveEnvironment()
  const queryClient = useQueryClient()
  const session = useDaemonSession()
  const query = useDaemonQuery(terminalSessionsQuery, undefined, {
    backstopMs: TERMINAL_BACKSTOP_MS,
    enabled: focused && repo !== null,
  })
  const renameMutation = useDaemonMutation(renameTerminalMutation, {
    invalidates: [terminalSessionsQuery.name],
  })

  const queryKey = useMemo(
    () => daemonKeys.call(environment?.id ?? 'none', terminalSessionsQuery.name, undefined),
    [environment?.id],
  )

  useEffect(() => {
    if (environment === null) return
    return session.subscribe((message) => {
      if (message.t !== 'terminal:exit') return
      queryClient.setQueryData<TerminalInfo[]>(queryKey, (current) =>
        current?.map((terminal) =>
          terminal.id === message.id
            ? { ...terminal, exitCode: message.exitCode, status: 'exited' }
            : terminal,
        ),
      )
    })
  }, [environment, queryClient, queryKey, session])

  const rename = useCallback(
    async (id: string, name: string): Promise<void> => {
      const trimmed = name.trim()
      if (trimmed === '') throw new Error('A terminal name cannot be empty.')
      const previous = queryClient.getQueryData<TerminalInfo[]>(queryKey)
      queryClient.setQueryData<TerminalInfo[]>(queryKey, (current) =>
        current?.map((terminal) =>
          terminal.id === id ? { ...terminal, name: trimmed } : terminal,
        ),
      )
      try {
        await renameMutation.mutateAsync({ id, name: trimmed })
      } catch (error) {
        queryClient.setQueryData(queryKey, previous)
        throw error
      }
    },
    [queryClient, queryKey, renameMutation],
  )

  /**
   * A kill is the one terminal event the daemon never announces. `evict` deletes the session
   * before killing the PTY precisely so `onExit` skips the fan-out, so no `terminal:exit` arrives
   * and the subscription above never fires — the row sat there looking alive until the 10s
   * backstop refetched, which reads as a button that does nothing. The client that asked for the
   * kill already knows the answer, so it drops the row itself and lets the refetch reconcile.
   */
  const kill = useCallback(
    (id: string): void => {
      session.send({ id, t: 'terminal:kill' })
      queryClient.setQueryData<TerminalInfo[]>(queryKey, (current) =>
        current?.filter((terminal) => terminal.id !== id),
      )
      queryClient.invalidateQueries({ queryKey }).catch(() => {})
    },
    [queryClient, queryKey, session],
  )

  const sessions = useMemo(() => {
    const all = query.data ?? []
    if (showAll || repo === null) return all
    return all.filter(
      (terminal) => terminal.cwd === repo.path || terminal.cwd.startsWith(`${repo.path}/`),
    )
  }, [query.data, repo, showAll])

  return { ...query, kill, rename, sessions }
}
