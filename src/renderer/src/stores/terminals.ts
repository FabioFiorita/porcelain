import { primary } from '@renderer/lib/daemon'
import {
  forgetLocalTerminal,
  localDaemonClient,
  localDaemonSession,
  markLocalTerminal,
  sessionForTerminal,
} from '@renderer/lib/local-daemon'
import { disposeTerminal } from '@renderer/lib/terminal-registry'
import { trpcClient } from '@renderer/lib/trpc'
import { tabId, useTabsStore } from '@renderer/stores/tabs'
import { create } from 'zustand'

/**
 * The terminal-session roster: the sidebar's list of open PTYs (id, roster label, and
 * whether it's still running). The PTY itself lives in the daemon (terminal-manager) and
 * its xterm instance in the registry — this store is just the list the sidebar renders
 * and the lifecycle the app drives.
 *
 * As of Phase 2 the roster is DAEMON-OWNED and sessions survive a renderer reload: the
 * daemon holds the authoritative name/cwd/status (terminalSessions query), and a hook
 * (`use-terminals`) hydrates this store from it on repo open and daemon reconnect. So a
 * still-running session (a background dev server) reappears after a reload, and a
 * renamed one keeps its name (rename writes through to the daemon). A session is
 * independent of its viewer tab: closing the tab leaves the PTY running; `close` is the
 * explicit kill — it ends the PTY and closes its viewer tab too, so a killed session
 * can't leave a black, dead terminal tab behind. `reset` (repo switch) is LOCAL-ONLY now
 * — it clears this window's view without killing the PTYs, which survive the switch (a
 * different repo just filters them out of the hydrated list).
 *
 * A session also carries WHICH machine it runs on (`origin`). Almost always that's
 * `primary` — the daemon this window is bound to — but a window on a remote daemon can
 * also spawn one on `local`, the machine running the app (see lib/local-daemon.ts). The
 * store keeps the distinction so the roster can label it and every lifecycle call
 * (create/kill/rename/detach) reaches the right daemon; `sessionForTerminal` is the router.
 */
export type TerminalOrigin = 'primary' | 'local'

export interface TerminalSession {
  id: string
  name: string
  status: 'running' | 'exited'
  exitCode?: number
  origin: TerminalOrigin
}

interface TerminalsState {
  sessions: TerminalSession[]
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
  }) => Promise<string>
  /** Rename a session's roster label (trimmed; empty and unknown ids are ignored). The
   *  caller retitles any open terminal tab(s) — this store doesn't reach into tabs. */
  rename: (id: string, name: string) => void
  /** Mark a session exited (its PTY closed on its own) — kept in the roster, not removed. */
  markExited: (id: string, exitCode: number) => void
  /** Kill the PTY, dispose its terminal, and drop it from the roster. */
  close: (id: string) => void
  /** Local teardown on repo switch: dispose xterm instances + clear the roster. Does NOT
   *  kill the PTYs — sessions survive a repo switch and re-hydrate if the repo returns. */
  reset: () => void
}

export const useTerminalsStore = create<TerminalsState>((set, get) => ({
  sessions: [],
  // The daemon owns the roster, so hydrate REPLACES: the incoming repo-filtered list is
  // authoritative (a session killed in another window drops out here on the next poll).
  // `create` still appends optimistically for zero-latency feedback; the vanishingly
  // narrow window where an in-flight `terminalSessions` snapshot predating that create
  // clobbers the fresh row self-heals on the next poll (≤5s) — the daemon session really
  // exists (create awaited its id), so it comes back for real. Not worth a stateful merge
  // that would instead resurrect a cross-window-killed row forever.
  hydrate: (sessions) => set({ sessions }),
  create: async ({ cwd, name, initialInput, origin = 'primary' }) => {
    const session = origin === 'local' ? localDaemonSession() : primary
    if (session === null) {
      // Only reachable if a caller asks for a local terminal before the endpoint resolved
      // — the UI awaits it, so this is a programming error, not a user-facing state.
      throw new Error('The local daemon connection is not ready yet.')
    }
    // The daemon stores the name (roster is daemon-owned); we still append locally so the
    // row shows immediately, before the next hydrate confirms it.
    const id = await session.createTerminal({ cwd, name, initialInput })
    // Register BEFORE the row exists: the registry may write to this id (an initialInput
    // action, the first keystroke) as soon as the view mounts, and it routes by this map.
    if (origin === 'local') markLocalTerminal(id)
    set((state) => ({ sessions: [...state.sessions, { id, name, status: 'running', origin }] }))
    return id
  },
  rename: (id, name) => {
    const trimmed = name.trim()
    if (trimmed === '') return
    // Write through to the daemon that OWNS this session so the rename survives a reload
    // (the roster is daemon-owned); optimistically update the row too.
    const client =
      get().sessions.find((s) => s.id === id)?.origin === 'local' ? localDaemonClient() : trpcClient
    client?.renameTerminal.mutate({ id, name: trimmed })
    set((state) => ({
      sessions: state.sessions.map((s) => (s.id === id ? { ...s, name: trimmed } : s)),
    }))
  },
  // A PTY that exits on its own (the shell was `exit`ed, or an action's command ran and
  // the shell closed) stays in the roster marked "exited" so its final output is still
  // readable; the human dismisses it with `close`.
  markExited: (id, exitCode) =>
    set((state) => ({
      sessions: state.sessions.map((s) => (s.id === id ? { ...s, status: 'exited', exitCode } : s)),
    })),
  close: (id) => {
    sessionForTerminal(id).killTerminal(id)
    forgetLocalTerminal(id)
    disposeTerminal(id)
    // The PTY and its xterm are gone; close any viewer tab still pointing at it so
    // the pane doesn't render a dead terminal. (Cross-store getState() from a store
    // action is the sanctioned pattern — see repo.switchTo.)
    useTabsStore.getState().closeTabEverywhere(tabId('terminal', id))
    set((state) => ({ sessions: state.sessions.filter((s) => s.id !== id) }))
  },
  reset: () => {
    // Local-only teardown on repo switch: detach from each PTY (so its live stream stops
    // arriving at a torn-down xterm) and dispose the xterm instance, but DON'T kill —
    // the PTYs survive the switch (explicit kill only). Detaching also frees the id to
    // re-attach (and replay scrollback into a fresh xterm) if the repo comes back.
    for (const session of get().sessions) {
      sessionForTerminal(session.id).detachTerminal(session.id)
      disposeTerminal(session.id)
    }
    set({ sessions: [] })
  },
}))
