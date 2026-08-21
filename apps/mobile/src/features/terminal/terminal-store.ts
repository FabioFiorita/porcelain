import type { TerminalInfo } from '@porcelain/contracts/terminal'
import { settleBackground } from '@porcelain/shared/background'
import { create } from 'zustand'

import { disposeTerminal, fitTerminal, nextTerminalSize } from './terminal-engine'
import { nextTerminalNumber } from './terminal-naming'
import { mobileTerminalAdapter } from './terminal-stream-adapter'

/**
 * The roster: every PTY the paired daemon owns, as this device last read it.
 *
 * The roster is DAEMON-OWNED — the daemon holds the authoritative name, cwd and status, and
 * every session outlives this app. `hydrate` therefore REPLACES rather than merges: a shell
 * killed from the desktop client has to disappear here on the next read. `spawn` still
 * appends optimistically so a new terminal appears the instant you ask for it.
 *
 * It is DAEMON-WIDE, not repo-scoped: the Terminals tab is the one terminal surface, and it
 * groups by `cwd` (`groupTerminalSessions`) rather than filtering to the selected checkout.
 * Which session is on screen is the route's business — the phone reads it from the URL and
 * gets the pop gesture and the hardware back button for free.
 */

/** A roster row, shaped exactly like the wire record so it can be grouped without a mapping. */
export type TerminalSession = TerminalInfo

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
  hydrate: (sessions: TerminalSession[]) => void
  /** Spawn a PTY and add it to the roster; resolves with the daemon-minted id. */
  spawn: (opts: { cwd: string; name?: string; initialInput?: string }) => Promise<string>
  rename: (id: string, name: string) => void
  markExited: (id: string, exitCode: number) => void
  /** Kill the PTY, drop its emulator, and remove the row. The only thing that ends a shell. */
  close: (id: string) => void
  /** Environment switch: let go of every session WITHOUT killing anything. */
  reset: () => void
}

/**
 * Kill a shell this client may never have opened.
 *
 * The kill frame is only minted for a session the stream state knows (`terminal-stream.kill`
 * returns nothing for an unattached id), and the Terminals tab lists every PTY on the daemon —
 * including the ones started from the desktop client or by a Worktree script. Without the
 * attach, killing a row you had not opened silently did nothing.
 */
async function killWherever(id: string): Promise<void> {
  const adapter = mobileTerminalAdapter()
  if (!adapter.isTerminalAttached(id)) await adapter.attachTerminal(id)
  adapter.killTerminal(id)
  disposeTerminal(id)
}

export const useTerminalStore = create<TerminalState>()((set, get) => ({
  hydrate: (incoming: TerminalSession[]) => {
    const daemonIds = new Set(incoming.map((session) => session.id))
    pruneTombstones(daemonIds)
    set({ sessions: incoming.filter((session) => !tombstones.has(session.id)) })
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
    settleBackground(killWherever(id), 'fallback')
    set((state) => ({ sessions: state.sessions.filter((session) => session.id !== id) }))
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
    // Detach, never kill: these PTYs survive an Environment switch and re-hydrate if it
    // comes back.
    for (const session of get().sessions) {
      mobileTerminalAdapter().detachTerminal(session.id)
      disposeTerminal(session.id)
    }
    set({ sessions: [] })
  },
  sessions: [],
  spawn: async ({ cwd, name, initialInput }) => {
    numberFloor = nextTerminalNumber(
      get().sessions.map((session) => session.name),
      numberFloor,
    )
    const label = name ?? `Terminal ${numberFloor}`
    // Spawn at the grid this device last measured rather than the daemon's 80×24 default: the
    // shell's first frame — and an agent CLI's whole first screen — is drawn before any view
    // has mounted to correct it, and a TUI redrawn at a new size is a visible reflow.
    const size = nextTerminalSize()
    const id = await mobileTerminalAdapter().createTerminal({
      cols: size?.cols,
      cwd,
      initialInput,
      name: label,
      rows: size?.rows,
    })
    tombstones.delete(id)
    // Remember it against the daemon-minted id too, so output that arrives before the view
    // mounts is written into an emulator of the same size the PTY is running at.
    if (size !== undefined) fitTerminal(id, size.cols, size.rows)
    // Optimistic row carries `cwd` and `createdAt` because the list groups by directory: a row
    // without them would land in "Elsewhere" for the five seconds before the first poll.
    set((state) => ({
      sessions: [
        ...state.sessions,
        { createdAt: Date.now(), cwd, id, name: label, status: 'running' as const },
      ],
    }))
    return id
  },
}))
