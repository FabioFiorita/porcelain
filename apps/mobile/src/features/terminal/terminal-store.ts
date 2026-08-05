import { create } from 'zustand'

import {
  createTerminal as createDaemonTerminal,
  detachTerminal,
  killTerminal,
} from '@/lib/daemon/terminal'

import { disposeTerminal } from './terminal-engine'
import { nextTerminalNumber } from './terminal-naming'

/**
 * The roster: which PTYs this repo has open, and which one the tablet's viewer is showing.
 *
 * The roster is DAEMON-OWNED — the daemon holds the authoritative name, cwd and status, and
 * every session outlives this app. `hydrate` therefore REPLACES rather than merges: a shell
 * killed from the desktop client has to disappear here on the next read. `create` still
 * appends optimistically so a new terminal appears the instant you ask for it.
 *
 * Selection is the TABLET's model only, exactly as in Changes: the tablet viewer is a column
 * no route owns, while the phone reads its session from the route and gets the pop gesture
 * and hardware back button for free.
 */

export type TerminalSession = {
  id: string
  name: string
  status: 'running' | 'exited'
  exitCode?: number
}

/**
 * Ids the human killed that a stale roster poll must not resurrect. Without this, kill →
 * optimistic drop → an in-flight `terminalSessions` snapshot still lists the PTY → hydrate
 * replaces → the row pops back, usually as "exited".
 */
const tombstones = new Map<string, number>()
const TOMBSTONE_MS = 15_000

/** Test-only: clear tombstones between cases. */
export function __resetTerminalTombstones(): void {
  tombstones.clear()
}

function pruneTombstones(daemonIds: Set<string>): void {
  const now = Date.now()
  for (const [id, at] of tombstones) {
    if (!daemonIds.has(id) || now - at > TOMBSTONE_MS) tombstones.delete(id)
  }
}

/**
 * Monotonic naming floor. A stale poll can transiently clobber the optimistic roster, and a
 * spawn inside that window would otherwise recount from a shorter list and reissue a number.
 */
let numberFloor = 0

type TerminalState = {
  sessions: TerminalSession[]
  /** Tablet only: the session its viewer column is showing. */
  selectedId: string | null
  hydrate: (sessions: TerminalSession[]) => void
  select: (id: string | null) => void
  /** Spawn a PTY and add it to the roster; resolves with the daemon-minted id. */
  spawn: (opts: { cwd: string; name?: string; initialInput?: string }) => Promise<string>
  rename: (id: string, name: string) => void
  markExited: (id: string, exitCode: number) => void
  /** Kill the PTY, drop its emulator, and remove the row. The only thing that ends a shell. */
  close: (id: string) => void
  /** Repo or environment switch: let go of every session WITHOUT killing anything. */
  reset: () => void
}

export const useTerminalStore = create<TerminalState>()((set, get) => ({
  hydrate: (incoming: TerminalSession[]) => {
    const daemonIds = new Set(incoming.map((session) => session.id))
    pruneTombstones(daemonIds)
    const sessions = incoming.filter((session) => !tombstones.has(session.id))
    set((state) => ({
      sessions,
      // A selection whose PTY is gone would leave the viewer pointed at nothing.
      selectedId: sessions.some((session) => session.id === state.selectedId)
        ? state.selectedId
        : (sessions[0]?.id ?? null),
    }))
  },
  markExited: (id: string, exitCode: number) => {
    // An exited PTY stays in the roster so its final output is still readable; the human
    // dismisses it explicitly. Never resurrect a row that was already closed.
    if (tombstones.has(id)) return
    set((state) => ({
      sessions: state.sessions.map((session) =>
        session.id === id ? { ...session, exitCode, status: 'exited' as const } : session,
      ),
    }))
  },
  close: (id: string) => {
    tombstones.set(id, Date.now())
    killTerminal(id)
    disposeTerminal(id)
    set((state) => {
      const sessions = state.sessions.filter((session) => session.id !== id)
      return {
        sessions,
        selectedId: state.selectedId === id ? (sessions[0]?.id ?? null) : state.selectedId,
      }
    })
  },
  rename: (id: string, name: string) => {
    const trimmed = name.trim()
    if (trimmed === '') return
    // The daemon owns the roster, so the caller writes through to it (a mutation needs the
    // React Query seam); this is the optimistic half.
    set((state) => ({
      sessions: state.sessions.map((session) =>
        session.id === id ? { ...session, name: trimmed } : session,
      ),
    }))
  },
  reset: () => {
    // Detach, never kill: these PTYs survive a repo switch and re-hydrate if it comes back.
    for (const session of get().sessions) {
      detachTerminal(session.id)
      disposeTerminal(session.id)
    }
    set({ selectedId: null, sessions: [] })
  },
  select: (id: string | null) => {
    set({ selectedId: id })
  },
  selectedId: null,
  sessions: [],
  spawn: async ({ cwd, name, initialInput }) => {
    numberFloor = nextTerminalNumber(
      get().sessions.map((session) => session.name),
      numberFloor,
    )
    const label = name ?? `Terminal ${numberFloor}`
    const id = await createDaemonTerminal({ cwd, initialInput, name: label })
    tombstones.delete(id)
    set((state) => ({
      selectedId: id,
      sessions: [...state.sessions, { id, name: label, status: 'running' as const }],
    }))
    return id
  },
}))
