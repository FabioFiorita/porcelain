import {
  attachTerminal,
  isTerminalAttached,
  onTerminalData,
  onTerminalExit,
  onTerminalScrollback,
} from '@renderer/lib/daemon'
import { receiveData, receiveExit, receiveScrollback } from '@renderer/lib/terminal-registry'
import { trpc } from '@renderer/lib/trpc'
import { useRepoStore } from '@renderer/stores/repo'
import { useTerminalsStore } from '@renderer/stores/terminals'
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
 */
export function useTerminalChannel(): void {
  const markExited = useTerminalsStore((s) => s.markExited)
  const hydrate = useTerminalsStore((s) => s.hydrate)
  const repoPath = useRepoStore((s) => s.repo?.path ?? null)
  const { data: sessions } = trpc.terminalSessions.useQuery(undefined, {
    enabled: repoPath !== null,
    refetchInterval: 5000,
  })

  useEffect(() => {
    const offData = onTerminalData(receiveData)
    const offScrollback = onTerminalScrollback(receiveScrollback)
    const offExit = onTerminalExit((id, exitCode) => {
      receiveExit(id, exitCode)
      markExited(id, exitCode)
    })
    return () => {
      offData()
      offScrollback()
      offExit()
    }
  }, [markExited])

  useEffect(() => {
    if (repoPath === null || sessions === undefined) return
    const inRepo = sessions.filter((s) => s.cwd === repoPath || s.cwd.startsWith(`${repoPath}/`))
    hydrate(inRepo.map((s) => ({ id: s.id, name: s.name, status: s.status, exitCode: s.exitCode })))
    for (const session of inRepo) {
      if (isTerminalAttached(session.id)) continue
      // Fire-and-forget: the scrollback replays through onTerminalScrollback → the
      // registry. The promise result (found/state) isn't needed here — the roster
      // already carries status, and an unknown id (found=false) just replays nothing.
      attachTerminal(session.id).catch(() => {
        // A dropped socket rejects the attach (lib/daemon drops the id on reject); the
        // next roster refetch after reconnect re-attaches it.
      })
    }
  }, [repoPath, sessions, hydrate])
}
