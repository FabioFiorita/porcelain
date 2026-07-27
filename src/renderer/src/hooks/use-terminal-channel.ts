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
import { useEffect } from 'react'

/**
 * Consumes the inbound half of the terminal stream on the daemon WS session
 * (lib/daemon.ts) AND hydrates the daemon-owned roster, mounted once in AppShell — the
 * inbound twin of `useAppEvents`. PTY output routes to the matching xterm (via the
 * registry, which buffers until the view mounts); an exit writes the footer and marks
 * the roster session "exited"; a re-attach's scrollback replays into the xterm.
 *
 * Roster hydration (Phase 2 — sessions survive reload): `terminalSessions` lists every
 * daemon-owned PTY; we filter to the ones whose cwd is inside the current repo and
 * hydrate the store. React-query refetches this on daemon reconnect (the blanket
 * invalidate in useAppEvents) so the roster recovers a reload/restart, and on a 5s poll
 * so a session killed in ANOTHER window (or an exit) reconciles here without waiting for
 * a reconnect. Each not-yet-attached session is attached once so its
 * scrollback replays into a freshly-created xterm; ids already attached (created this
 * session, or attached on a prior hydrate) are skipped — lib/daemon re-attaches those
 * itself on reconnect. `isTerminalAttached` is the single source of truth, so the poll is
 * idempotent and a repo switch back (which detaches on `reset`) re-attaches cleanly.
 *
 * TWO daemons since 2026-07-26: the same treatment runs against the local session when the
 * window is remote-bound and the repo has a mapped local directory ("This device"
 * terminals — lib/local-daemon.ts). Both rosters hydrate the store in ONE call, because
 * `hydrate` REPLACES; a second call per daemon would leave whichever ran last as the
 * whole list. Local ids are re-registered on every hydrate so a reload knows where a
 * surviving session lives before anything writes to it.
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
      primary.attachTerminal(session.id).catch(() => {
        // A dropped socket rejects the attach (lib/daemon drops the id on reject); the
        // next roster refetch after reconnect re-attaches it.
      })
    }
    const local = localDaemonSession()
    if (local === null) return
    for (const session of localSessions) {
      if (local.isTerminalAttached(session.id)) continue
      local.attachTerminal(session.id).catch(() => {
        // Same as above — the next poll re-attaches after a reconnect.
      })
    }
  }, [repoPath, sessions, localSessions, hydrate])
}
