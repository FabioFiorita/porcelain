import { disposeTerminal } from '@renderer/lib/terminal-registry'
import { create } from 'zustand'

/**
 * The terminal-session roster: client-only metadata for each open PTY (its id, the
 * roster label, and whether it's still running). The PTY itself lives in the main
 * process (terminal-manager) and its xterm instance in the registry — this store is
 * just the list the sidebar renders and the lifecycle the app drives. NOT persisted:
 * PTYs are ephemeral, so sessions don't survive a reload (Actions, which are
 * definitions, do persist — see actions-store).
 *
 * A session is independent of its viewer tab: closing the tab leaves the PTY running
 * (so a background dev server keeps going and stays in this roster); `close` is what
 * actually kills the PTY and disposes the terminal.
 */
export interface TerminalSession {
  id: string
  name: string
  status: 'running' | 'exited'
  exitCode?: number
}

interface TerminalsState {
  sessions: TerminalSession[]
  /** Spawn a PTY in `cwd` (optionally typing a command into it) and add it to the roster. */
  create: (opts: { cwd: string; name: string; initialInput?: string }) => Promise<string>
  /** Mark a session exited (its PTY closed on its own) — kept in the roster, not removed. */
  markExited: (id: string, exitCode: number) => void
  /** Kill the PTY, dispose its terminal, and drop it from the roster. */
  close: (id: string) => void
  /** Kill every session — used on repo switch. */
  reset: () => void
}

export const useTerminalsStore = create<TerminalsState>((set, get) => ({
  sessions: [],
  create: async ({ cwd, name, initialInput }) => {
    const id = await window.porcelain.terminal.create({ cwd, initialInput })
    set((state) => ({ sessions: [...state.sessions, { id, name, status: 'running' }] }))
    return id
  },
  // A PTY that exits on its own (the shell was `exit`ed, or an action's command ran and
  // the shell closed) stays in the roster marked "exited" so its final output is still
  // readable; the human dismisses it with `close`.
  markExited: (id, exitCode) =>
    set((state) => ({
      sessions: state.sessions.map((s) => (s.id === id ? { ...s, status: 'exited', exitCode } : s)),
    })),
  close: (id) => {
    window.porcelain.terminal.kill(id)
    disposeTerminal(id)
    set((state) => ({ sessions: state.sessions.filter((s) => s.id !== id) }))
  },
  reset: () => {
    for (const session of get().sessions) {
      window.porcelain.terminal.kill(session.id)
      disposeTerminal(session.id)
    }
    set({ sessions: [] })
  },
}))
