import {
  useLocalDaemon,
  useLocalTerminalPath,
  useLocalTerminalSessions,
} from '@renderer/hooks/use-local-terminal'
import { primary } from '@renderer/lib/daemon'
import { localDaemonSession, markLocalTerminal } from '@renderer/lib/local-daemon'
import { receiveData, receiveExit, receiveScrollback } from '@renderer/lib/terminal-registry'
import { trpc } from '@renderer/lib/trpc'
import { useRepoStore } from '@renderer/stores/repo'
import { type TerminalSession, useTerminalsStore } from '@renderer/stores/terminals'
import { settleBackground } from '@shared/background'
import { useEffect } from 'react'

/**
 * Consumes the inbound half of the terminal stream on the daemon session AND
 * hydrates the daemon-owned roster, mounted once in AppShell — the stream twin of
 * `useSessionRuntime` (which owns change invalidation on the same socket). PTY
 * output routes to the matching Ghostty (buffered via the registry until the view
 * mounts); an exit marks the roster session "exited"; a re-attach's scrollback
 * replays into the Ghostty.
 *
 * Roster hydration: `terminalSessions` lists every daemon-owned PTY; filter to the
 * current repo and hydrate the store. Refetches on daemon reconnect and on a 5s
 * poll, so a session killed in ANOTHER window reconciles without waiting for a
 * reconnect. Each not-yet-attached session attaches once (scrollback into a fresh
 * Ghostty); already-attached ids are skipped — lib/daemon re-attaches those itself.
 * `isTerminalAttached` is the single source of truth, so the poll is idempotent.
 *
 * TWO daemons: the same treatment runs against the local session when remote-bound
 * with a mapped local directory ("This device" — lib/local-daemon.ts). Both rosters
 * hydrate in ONE call, because `hydrate` REPLACES; local ids re-register on every
 * hydrate so a reload knows where a surviving session lives first.
 */
export function useTerminalChannel(): void {
  const markExited = useTerminalsStore((s) => s.markExited)
  const hydrate = useTerminalsStore((s) => s.hydrate)
  const repoPath = useRepoStore((s) => s.repo?.path ?? null)
  const { data: sessions } = trpc.terminalSessions.useQuery(undefined, {
    enabled: repoPath !== null,
    refetchInterval: 5000,
  })

  const localDaemon = useLocalDaemon()
  const mappedPath = useLocalTerminalPath(repoPath)
  // Only reach for the other machine when this window is actually on a remote one AND the
  // human has mapped a directory there; otherwise the local session never connects.
  const localPath = localDaemon?.isLocal === false ? (mappedPath ?? null) : null
  const localSessions = useLocalTerminalSessions(localPath)

  useEffect(() => {
    // Both live sessions feed the ONE registry: ids are daemon-minted, so a stream can be
    // routed by id alone. `localPath` is what establishes the local session, so it's also
    // the trigger to re-subscribe once that session exists.
    const local = localPath === null ? null : localDaemonSession()
    const sessions = local === null ? [primary] : [primary, local]
    const offs = sessions.flatMap((session) => [
      session.onTerminalData(receiveData),
      session.onTerminalScrollback(receiveScrollback),
      session.onTerminalExit((id, exitCode) => {
        receiveExit(id, exitCode)
        markExited(id, exitCode)
      }),
    ])
    return () => {
      for (const off of offs) off()
    }
  }, [markExited, localPath])

  useEffect(() => {
    if (repoPath === null || sessions === undefined) return
    const inRepo = sessions.filter((s) => s.cwd === repoPath || s.cwd.startsWith(`${repoPath}/`))
    const rows: TerminalSession[] = [
      ...inRepo.map((s) => ({
        id: s.id,
        name: s.name,
        status: s.status,
        exitCode: s.exitCode,
        origin: 'primary' as const,
      })),
      ...localSessions.map((s) => ({
        id: s.id,
        name: s.name,
        status: s.status,
        exitCode: s.exitCode,
        origin: 'local' as const,
      })),
    ]
    // Before hydrating: a session that outlived this window must be routable (writes,
    // kills) the moment its row exists.
    for (const session of localSessions) markLocalTerminal(session.id)
    hydrate(rows)

    for (const session of inRepo) {
      if (primary.isTerminalAttached(session.id)) continue
      // Fire-and-forget: the scrollback replays through onTerminalScrollback → the
      // registry. The promise result (found/state) isn't needed here — the roster
      // already carries status, and an unknown id (found=false) just replays nothing.
      // A dropped socket rejects the attach (lib/daemon drops the id on reject); the
      // next roster refetch after reconnect re-attaches it.
      settleBackground(primary.attachTerminal(session.id), 'lifecycle')
    }
    const local = localDaemonSession()
    if (local === null) return
    for (const session of localSessions) {
      if (local.isTerminalAttached(session.id)) continue
      // Same as above — the next poll re-attaches after a reconnect.
      settleBackground(local.attachTerminal(session.id), 'lifecycle')
    }
  }, [repoPath, sessions, localSessions, hydrate])
}
