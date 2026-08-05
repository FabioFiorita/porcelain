import { useEffect, useMemo } from 'react'

import type { DaemonError } from '@/lib/daemon/errors'
import {
  actionsQuery,
  renameTerminalMutation,
  type TerminalAction,
  terminalSessionsQuery,
  trustActionsMutation,
} from '@/lib/daemon/procedures/terminal'
import { useDaemonMutation, useDaemonQuery } from '@/lib/daemon/queries'
import { useActiveRepo } from '@/lib/daemon/repo'
import { attachTerminal, isTerminalAttached, subscribeTerminalStream } from '@/lib/daemon/terminal'

import { receiveData, receiveExit, receiveScrollback } from './terminal-engine'
import { type TerminalSession, useTerminalStore } from './terminal-store'

/**
 * A session killed from another client — the desktop app, a second phone — has to disappear
 * here without waiting for a reconnect, and the daemon pushes no roster event. So it polls,
 * at the same 5s the desktop client uses.
 */
const ROSTER_POLL_MS = 5_000

/**
 * The inbound half of the terminal stream plus roster hydration — mounted once by the
 * Terminal surface, the twin of the desktop client's `useTerminalChannel`.
 *
 * PTY output routes to the matching emulator (buffered by the registry until it exists), an
 * exit marks the roster row exited, and a re-attach's scrollback replays. Every listed
 * session attaches once so its history is there the moment you open it; already-attached ids
 * are skipped, which is what makes the poll idempotent.
 */
export function useTerminals(active: boolean): {
  sessions: TerminalSession[]
  isLoading: boolean
  error: DaemonError | null
} {
  const repo = useActiveRepo()
  const repoPath = repo?.path ?? ''
  const hydrate = useTerminalStore((state) => state.hydrate)
  const markExited = useTerminalStore((state) => state.markExited)
  const sessions = useTerminalStore((state) => state.sessions)

  const { data, error, isLoading } = useDaemonQuery(terminalSessionsQuery, undefined, {
    enabled: active && repo !== null,
    placeholderData: 'keepPreviousData',
    pollMs: ROSTER_POLL_MS,
    staleTime: 0,
  })

  useEffect(() => {
    return subscribeTerminalStream({
      onData: receiveData,
      onExit: (id, exitCode) => {
        receiveExit(id, exitCode)
        markExited(id, exitCode)
      },
      onScrollback: receiveScrollback,
    })
  }, [markExited])

  // The daemon lists every PTY it owns, across repos. This client shows one repo at a time,
  // so a shell opened in another project belongs to that project's roster, not this one.
  const inRepo = useMemo(
    () =>
      repoPath === ''
        ? []
        : (data ?? []).filter(
            (session) => session.cwd === repoPath || session.cwd.startsWith(`${repoPath}/`),
          ),
    [data, repoPath],
  )

  useEffect(() => {
    if (repoPath === '' || data === undefined) return
    hydrate(
      inRepo.map((session) => ({
        exitCode: session.exitCode,
        id: session.id,
        name: session.name,
        status: session.status,
      })),
    )
    for (const session of inRepo) {
      if (isTerminalAttached(session.id)) continue
      attachTerminal(session.id).catch(() => {
        // A dropped socket rejects the attach; the next poll after reconnect re-attaches it.
      })
    }
  }, [data, hydrate, inRepo, repoPath])

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

/** The repo's saved actions — the agent curates them; running one is human-only. */
export function useTerminalActions(active: boolean): {
  actions: TerminalAction[]
  error: DaemonError | null
} {
  const repo = useActiveRepo()
  const { data, error } = useDaemonQuery(actionsQuery, repo?.path ?? '', {
    enabled: active && repo !== null,
  })
  // `where: 'local'` runs on the machine displaying the window — an Electron-only idea, since
  // it needs a second daemon on that device. A phone has no local daemon, so those actions are
  // not runnable here and are filtered out rather than offered and then failing.
  const actions = useMemo(() => (data ?? []).filter((action) => action.where !== 'local'), [data])
  return { actions, error }
}

/**
 * Accept a command this daemon's machine has not run before. Trust is recorded against the
 * command TEXT, so an edited command asks again.
 */
export function useTrustAction(): (id: string) => Promise<void> {
  const repo = useActiveRepo()
  const mutation = useDaemonMutation(trustActionsMutation, { invalidates: ['actions'] })

  return async (id: string): Promise<void> => {
    if (repo === null) return
    await mutation.mutateAsync({ ids: [id], repoPath: repo.path })
  }
}
