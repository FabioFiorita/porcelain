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
 * its Ghostty instance in the registry — this store is just the list the sidebar renders.
 *
 * The roster is DAEMON-OWNED and sessions survive a renderer reload: the daemon holds the
 * authoritative name/cwd/status, and `use-terminals` hydrates this store from it on repo
 * open and daemon reconnect. A session is independent of its viewer tab: closing the tab
 * leaves the PTY running; `close` is the explicit kill — it ends the PTY and closes its
 * viewer tab too, so a killed session can't leave a black, dead terminal tab behind.
 * `reset` (repo switch) is LOCAL-ONLY — it clears this window's view without killing the
 * PTYs, which survive the switch (a different repo just filters them out of the list).
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
  /** Local teardown on repo switch: dispose Ghostty instances + clear the roster. Does NOT
   *  kill the PTYs — sessions survive a repo switch and re-hydrate if the repo returns. */
  reset: () => void
}

/**
 * Ids the human closed (X) that a stale `terminalSessions` poll must not resurrect.
 * Cleared once the daemon no longer lists them (or after TOMBSTONE_MS). Without this,
 * close → optimistic drop → 5s poll still lists the PTY → hydrate REPLACES and the
 * row pops back (often as "exited" when kill's onExit races in).
 */
const closedTombstones = new Map<string, number>()
const TOMBSTONE_MS = 15_000

/** Test-only: clear tombstones between cases. */
export function __resetTerminalTombstonesForTests(): void {
  closedTombstones.clear()
}

function pruneTombstones(daemonIds: Set<string>): void {
  const now = Date.now()
  for (const [id, at] of closedTombstones) {
    if (!daemonIds.has(id) || now - at > TOMBSTONE_MS) closedTombstones.delete(id)
  }
}

export const useTerminalsStore = create<TerminalsState>((set, get) => ({
  sessions: [],
  // The daemon owns the roster, so hydrate REPLACES: the incoming repo-filtered list is
  // authoritative (a session killed in another window drops out here on the next poll).
  // `create` still appends optimistically for zero-latency feedback; the vanishingly
  // narrow window where an in-flight `terminalSessions` snapshot predating that create
  // clobbers the fresh row self-heals on the next poll (≤5s) — the daemon session really
  // exists (create awaited its id), so it comes back for real. Not worth a stateful merge
  // that would instead resurrect a cross-window-killed row forever — except we DO filter
  // closedTombstones so a stale poll can't undo this window's close click.
  hydrate: (incoming: TerminalSession[]) => {
    const daemonIds = new Set(incoming.map((s) => s.id))
    pruneTombstones(daemonIds)
    const sessions = incoming.filter((s) => !closedTombstones.has(s.id))
    set({ sessions })
  },
  create: async ({
    cwd,
    name,
    initialInput,
    origin = 'primary',
  }: {
    cwd: string
    name: string
    initialInput?: string
    origin?: TerminalOrigin
  }) => {
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
    closedTombstones.delete(id)
    set((state) => ({ sessions: [...state.sessions, { id, name, status: 'running', origin }] }))
    return id
  },
  rename: (id: string, name: string) => {
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
  close: (id: string) => {
    closedTombstones.set(id, Date.now())
    sessionForTerminal(id).killTerminal(id)
    forgetLocalTerminal(id)
    disposeTerminal(id)
    // The PTY and its Ghostty are gone; close any viewer tab still pointing at it so
    // the pane doesn't render a dead terminal. (Cross-store getState() from a store
    // action is the sanctioned pattern — see repo.switchTo.)
    useTabsStore.getState().closeTabEverywhere(tabId('terminal', id))
    set((state) => ({ sessions: state.sessions.filter((s) => s.id !== id) }))
  },
  reset: () => {
    // Local-only teardown on repo switch: detach from each PTY (so its live stream stops
    // arriving at a torn-down Ghostty) and dispose the Ghostty instance, but DON'T kill —
    // the PTYs survive the switch (explicit kill only). Detaching also frees the id to
    // re-attach (and replay scrollback into a fresh Ghostty) if the repo comes back.
    for (const session of get().sessions) {
      sessionForTerminal(session.id).detachTerminal(session.id)
      disposeTerminal(session.id)
    }
    set({ sessions: [] })
  },
}))
