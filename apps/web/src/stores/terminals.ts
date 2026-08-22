import {
  renameTerminalOnDaemon,
  terminalAdapterFor,
  terminalAdapterForSession,
} from '@renderer/features/terminal'
import { type DaemonSession, primary } from '@renderer/lib/daemon'
import {
  forgetLocalTerminal,
  forgetTerminalSession,
  localDaemonClient,
  localDaemonSession,
  markLocalTerminal,
  registerTerminalSession,
  terminalClientFor,
} from '@renderer/lib/local-daemon'
import { disposeTerminal } from '@renderer/lib/terminal-registry'
import { settleBackground } from '@shared/background'
import { create } from 'zustand'

/**
 * The terminal-session roster this window can reach BEYOND the primary daemon's own list:
 * the sessions of the open checkout, plus every session the Terminals board could not see
 * on its own. The PTY itself lives in a daemon (terminal-manager) and its Ghostty instance
 * in the registry — this store only holds rows and which one the board is showing.
 *
 * The rows are DAEMON-OWNED and survive a renderer reload: the daemon holds the
 * authoritative name/cwd/status, and `use-terminals` hydrates this store from it on repo
 * open and daemon reconnect. The Terminals board polls the PRIMARY daemon's global roster
 * itself and merges these rows in by id, which is how "This device" shells and a selected
 * secondary Environment's shells reach the one terminal surface at all.
 *
 * `focusedId` is which session that surface shows. It lives here, not in the board, so a
 * spawn from anywhere (a saved Action, a Worktree lifecycle script, ⌘T) can put its shell
 * in front of the human — see `revealTerminal` in lib/terminal-actions.ts.
 *
 * `close` is the explicit kill: it ends the PTY and drops the row. `reset` is the local
 * teardown when this window opens a different Project in place (which closes every tab,
 * the Terminals one included); it never kills a PTY. Selecting another Worktree in the Hub
 * does neither — the board spans the whole daemon, so its shells stay on screen.
 *
 * A session also carries WHICH machine it runs on (`origin`). Almost always that's
 * `primary` — the daemon this window is bound to — but a window on a remote daemon can
 * also spawn one on `local` (see lib/local-daemon.ts); `sessionForTerminal` routes every
 * lifecycle call (create/kill/rename/detach) to the right daemon.
 */
export type TerminalOrigin = 'primary' | 'local'

export interface TerminalSession {
  id: string
  name: string
  /** Where the PTY was spawned; the board groups by longest path prefix on it. */
  cwd: string
  /** Daemon epoch ms; the board sorts on it so the list holds still under the poll. */
  createdAt: number
  status: 'running' | 'exited'
  exitCode?: number
  origin: TerminalOrigin
}

interface TerminalsState {
  sessions: TerminalSession[]
  /**
   * Session the Terminals surface shows. Not required to be in `sessions`: the board also
   * lists the primary daemon's own roster, which this store never holds.
   */
  focusedId: string | null
  /** Replace the roster with the daemon-owned sessions for the current repo (idempotent). */
  hydrate: (sessions: TerminalSession[]) => void
  /**
   * Spawn a PTY in `cwd` (optionally typing a command into it) and add it to the roster.
   * `origin` picks the machine — omitted means this window's daemon; `local` requires the
   * local session to already exist (the caller establishes it from the shell's endpoint).
   */
  create: (opts: {
    cwd: string
    name: string
    initialInput?: string
    origin?: TerminalOrigin
    session?: DaemonSession
  }) => Promise<string>
  /** Rename a session's roster label (trimmed; empty and unknown ids are ignored). */
  rename: (id: string, name: string) => void
  /** Mark a session exited (its PTY closed on its own) — kept in the roster, not removed. */
  markExited: (id: string, exitCode: number) => void
  /** Show this session on the Terminals surface. Any id — the board reconciles the rest. */
  focus: (id: string | null) => void
  /** Kill the PTY, dispose its terminal, and drop it from the roster. */
  close: (id: string) => void
  /** Local teardown when this window opens a DIFFERENT Project in place (every tab closes
   *  with it): dispose Ghostty instances + clear the roster. Does NOT kill the PTYs. */
  reset: () => void
}

/**
 * Ids the human closed (X) that a stale `terminalSessions` poll must not resurrect.
 * Retain them through the short roster-cache race: a fresh response can omit the id before
 * an older cached response containing it arrives. The TTL bounds the local protection while
 * still allowing a genuinely new daemon roster to become authoritative.
 */
const closedTombstones = new Map<string, number>()
const TOMBSTONE_MS = 15_000

/**
 * Ids this window just created that a roster snapshot PREDATING the create must not erase —
 * the mirror image of the tombstones above.
 *
 * `hydrate` replaces, and its input can be an in-flight `terminalSessions` response that was
 * issued before the PTY existed. The row would vanish for up to one poll, taking the focused
 * session with it: a saved Action opened a shell and the surface stayed on the previous one.
 * The daemon really has the session (create awaited its id), so holding the row for a bounded
 * window is honest, not optimistic. A hydration that DOES list the id retires the guard.
 */
const freshCreates = new Map<string, number>()
const FRESH_CREATE_MS = 15_000

/** Test-only: clear tombstones and fresh-create guards between cases. */
export function __resetTerminalTombstonesForTests(): void {
  closedTombstones.clear()
  freshCreates.clear()
}

function pruneAges(): void {
  const now = Date.now()
  for (const [id, at] of closedTombstones) {
    if (now - at > TOMBSTONE_MS) closedTombstones.delete(id)
  }
  for (const [id, at] of freshCreates) {
    if (now - at > FRESH_CREATE_MS) freshCreates.delete(id)
  }
}

export const useTerminalsStore = create<TerminalsState>((set, get) => ({
  sessions: [],
  focusedId: null,
  // The daemon owns the roster, so hydrate REPLACES: the incoming repo-filtered list is
  // authoritative (a session killed in another window drops out here on the next poll).
  // `create` still appends optimistically for zero-latency feedback; the vanishingly
  // narrow window where an in-flight `terminalSessions` snapshot predating that create
  // clobbers the fresh row self-heals on the next poll (≤5s) — the daemon session really
  // exists (create awaited its id), so it comes back for real. Not worth a stateful merge
  // that would instead resurrect a cross-window-killed row forever — except we DO filter
  // closedTombstones so a stale poll can't undo this window's close click.
  hydrate: (incoming: TerminalSession[]) => {
    pruneAges()
    const sessions = incoming.filter((s) => !closedTombstones.has(s.id))
    const listed = new Set(sessions.map((session) => session.id))
    for (const id of listed) freshCreates.delete(id)
    const held = get().sessions.filter(
      (session) => !listed.has(session.id) && freshCreates.has(session.id),
    )
    set({ sessions: [...sessions, ...held] })
  },
  create: async ({
    cwd,
    name,
    initialInput,
    origin = 'primary',
    session: explicitSession,
  }: {
    cwd: string
    name: string
    initialInput?: string
    origin?: TerminalOrigin
    session?: DaemonSession
  }) => {
    const session = explicitSession ?? (origin === 'local' ? localDaemonSession() : primary)
    if (session === null) {
      // Only reachable if a caller asks for a local terminal before the endpoint resolved
      // — the UI awaits it, so this is a programming error, not a user-facing state.
      throw new Error('The local daemon connection is not ready yet.')
    }
    // The daemon stores the name (roster is daemon-owned); we still append locally so the
    // row shows immediately, before the next hydrate confirms it.
    // Whichever daemon was named: `primary` when nobody named one, the local child daemon
    // for a This-device shell, or an Environment session for a shell on another machine.
    const adapter = terminalAdapterForSession(session)
    const id = await adapter.createTerminal({ cwd, name, initialInput })
    // Register BEFORE the row exists: the registry may write to this id (an initialInput
    // action, the first keystroke) as soon as the view mounts, and it routes by this map.
    if (origin === 'local') markLocalTerminal(id)
    else if (session !== primary) registerTerminalSession(id, session)
    closedTombstones.delete(id)
    freshCreates.set(id, Date.now())
    set((state) => ({
      sessions: [
        ...state.sessions,
        { id, name, cwd, createdAt: Date.now(), status: 'running', origin },
      ],
      focusedId: id,
    }))
    return id
  },
  rename: (id: string, name: string) => {
    const trimmed = name.trim()
    if (trimmed === '') return
    // Write through to the daemon that OWNS this session so the rename survives a reload
    // (the roster is daemon-owned); optimistically update the row too. Fire-and-forget:
    // the five-second roster poll remains the backstop (no mandatory invalidation).
    const client =
      get().sessions.find((s) => s.id === id)?.origin === 'local'
        ? localDaemonClient()
        : terminalClientFor(id)
    if (client !== null) {
      settleBackground(renameTerminalOnDaemon(client, { id, name: trimmed }), 'fallback')
    }
    set((state) => ({
      sessions: state.sessions.map((s) => (s.id === id ? { ...s, name: trimmed } : s)),
    }))
  },
  // A PTY that exits on its own (the shell was `exit`ed, or an action's command ran and
  // the shell closed) stays in the roster marked "exited" so its final output is still
  // readable; the human dismisses it with `close`. Never re-add a row for an id the
  // human already closed (tombstone / not in the list).
  markExited: (id: string, exitCode: number) => {
    if (closedTombstones.has(id)) return
    set((state) => {
      if (!state.sessions.some((s) => s.id === id)) return state
      return {
        sessions: state.sessions.map((s) =>
          s.id === id ? { ...s, status: 'exited' as const, exitCode } : s,
        ),
      }
    })
  },
  focus: (id: string | null) => set({ focusedId: id }),
  close: (id: string) => {
    closedTombstones.set(id, Date.now())
    freshCreates.delete(id)
    terminalAdapterFor(id).killTerminal(id)
    forgetLocalTerminal(id)
    forgetTerminalSession(id)
    disposeTerminal(id)
    set((state) => ({
      sessions: state.sessions.filter((s) => s.id !== id),
      focusedId: state.focusedId === id ? null : state.focusedId,
    }))
  },
  reset: () => {
    // Detach from each PTY (so its live stream stops arriving at a torn-down Ghostty) and
    // dispose the Ghostty instance, but DON'T kill — the PTYs survive (explicit kill only).
    // Detaching also frees the id to re-attach and replay scrollback if the repo comes back.
    for (const session of get().sessions) {
      terminalAdapterFor(session.id).detachTerminal(session.id)
      forgetTerminalSession(session.id)
      disposeTerminal(session.id)
    }
    set({ sessions: [], focusedId: null })
  },
}))
