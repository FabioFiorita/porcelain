import {
  renameTerminalOnDaemon,
  terminalAdapterFor,
  terminalAdapterForSession,
} from '@renderer/features/terminal'
import { primary } from '@renderer/lib/daemon'
import {
  forgetLocalTerminal,
  localDaemonClient,
  localDaemonSession,
  markLocalTerminal,
} from '@renderer/lib/local-daemon'
import { disposeTerminal } from '@renderer/lib/terminal-registry'
import { trpcClient } from '@renderer/lib/trpc'
import { tabId, useTabsStore } from '@renderer/stores/tabs'
import { settleBackground } from '@shared/background'
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
  /** Whether the Viewer-bottom terminal panel is visible. */
  panelOpen: boolean
  /** Session shown in the active bottom-panel tab. */
  panelSessionId: string | null
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
  openPanel: (sessionId?: string) => void
  closePanel: () => void
  togglePanel: () => void
  setPanelSession: (sessionId: string) => void
  /** Kill the PTY, dispose its terminal, and drop it from the roster. */
  close: (id: string) => void
  /** Local teardown on repo switch: dispose Ghostty instances + clear the roster. Does NOT
   *  kill the PTYs — sessions survive a repo switch and re-hydrate if the repo returns. */
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

/** Test-only: clear tombstones between cases. */
export function __resetTerminalTombstonesForTests(): void {
  closedTombstones.clear()
}

function pruneTombstones(): void {
  const now = Date.now()
  for (const [id, at] of closedTombstones) {
    if (now - at > TOMBSTONE_MS) closedTombstones.delete(id)
  }
}

export const useTerminalsStore = create<TerminalsState>((set, get) => ({
  sessions: [],
  panelOpen: false,
  panelSessionId: null,
  // The daemon owns the roster, so hydrate REPLACES: the incoming repo-filtered list is
  // authoritative (a session killed in another window drops out here on the next poll).
  // `create` still appends optimistically for zero-latency feedback; the vanishingly
  // narrow window where an in-flight `terminalSessions` snapshot predating that create
  // clobbers the fresh row self-heals on the next poll (≤5s) — the daemon session really
  // exists (create awaited its id), so it comes back for real. Not worth a stateful merge
  // that would instead resurrect a cross-window-killed row forever — except we DO filter
  // closedTombstones so a stale poll can't undo this window's close click.
  hydrate: (incoming: TerminalSession[]) => {
    pruneTombstones()
    const sessions = incoming.filter((s) => !closedTombstones.has(s.id))
    const currentPanelSession = get().panelSessionId
    const panelSessionId = sessions.some((session) => session.id === currentPanelSession)
      ? currentPanelSession
      : (sessions[0]?.id ?? null)
    set({ sessions, panelSessionId })
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
    const adapter =
      origin === 'local' && session !== null
        ? terminalAdapterForSession(session)
        : origin === 'primary'
          ? terminalAdapterForSession(primary)
          : null
    if (adapter === null) throw new Error('The local daemon connection is not ready yet.')
    const id = await adapter.createTerminal({ cwd, name, initialInput })
    // Register BEFORE the row exists: the registry may write to this id (an initialInput
    // action, the first keystroke) as soon as the view mounts, and it routes by this map.
    if (origin === 'local') markLocalTerminal(id)
    closedTombstones.delete(id)
    set((state) => ({
      sessions: [...state.sessions, { id, name, status: 'running', origin }],
      panelOpen: true,
      panelSessionId: id,
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
      get().sessions.find((s) => s.id === id)?.origin === 'local' ? localDaemonClient() : trpcClient
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
  openPanel: (sessionId?: string) =>
    set((state) => ({
      panelOpen: true,
      panelSessionId:
        sessionId !== undefined && state.sessions.some((session) => session.id === sessionId)
          ? sessionId
          : (state.panelSessionId ?? state.sessions[0]?.id ?? null),
    })),
  closePanel: () => set({ panelOpen: false }),
  togglePanel: () =>
    set((state) => ({
      panelOpen: !state.panelOpen,
      panelSessionId: state.panelOpen
        ? state.panelSessionId
        : (state.panelSessionId ?? state.sessions[0]?.id ?? null),
    })),
  setPanelSession: (sessionId: string) =>
    set((state) =>
      state.sessions.some((session) => session.id === sessionId)
        ? { panelSessionId: sessionId, panelOpen: true }
        : state,
    ),
  close: (id: string) => {
    closedTombstones.set(id, Date.now())
    terminalAdapterFor(id).killTerminal(id)
    forgetLocalTerminal(id)
    disposeTerminal(id)
    // The PTY and its Ghostty are gone; close any viewer tab still pointing at it so
    // the pane doesn't render a dead terminal. (Cross-store getState() from a store
    // action is the sanctioned pattern — see repo.switchProject.)
    useTabsStore.getState().closeTabEverywhere(tabId('terminal', id))
    set((state) => {
      const sessions = state.sessions.filter((s) => s.id !== id)
      return {
        sessions,
        panelOpen: sessions.length > 0 ? state.panelOpen : false,
        panelSessionId:
          state.panelSessionId === id ? (sessions[0]?.id ?? null) : state.panelSessionId,
      }
    })
  },
  reset: () => {
    // Local-only teardown on repo switch: detach from each PTY (so its live stream stops
    // arriving at a torn-down Ghostty) and dispose the Ghostty instance, but DON'T kill —
    // the PTYs survive the switch (explicit kill only). Detaching also frees the id to
    // re-attach (and replay scrollback into a fresh Ghostty) if the repo comes back.
    for (const session of get().sessions) {
      terminalAdapterFor(session.id).detachTerminal(session.id)
      disposeTerminal(session.id)
    }
    set({ sessions: [], panelOpen: false, panelSessionId: null })
  },
}))
