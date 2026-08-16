import type { AppRouter } from '@backend/api'
import type { createTRPCClient } from '@trpc/client'
import { createDaemonSession, type DaemonEndpoint, type DaemonSession, primary } from './daemon'
import { createAppClientFor, trpcClient } from './trpc'

/**
 * The SECOND daemon connection: the machine running the app, while the window works on a
 * remote one.
 *
 * Why: the repo lives on the box you're bound to (a Linux server), but some work only the
 * machine in front of you can do — an iOS build on the Mac. A terminal can spawn on "This
 * device" alongside the remote ones instead of leaving Porcelain entirely.
 *
 * Deliberately NARROW — not a general multi-daemon layer. The window's repo, git state,
 * agents, and every repo-scoped query still live on `primary`; reaching for a second session
 * for anything but "work on the OTHER machine" is doing it wrong. What lives here: one
 * session, one appRouter client for its terminal roster, and the id bookkeeping that routes
 * a write to the right daemon.
 *
 * Lifetime: created lazily on first local-terminal use (a purely-local window pays nothing)
 * and re-pointed — never rebuilt — when the local daemon restarts on a new port
 * (`local-daemon-changed`, see main/daemon.ts). Re-pointing keeps live PTY attachments, which
 * a rebuild would silently drop.
 */
let session: DaemonSession | null = null
let client: ReturnType<typeof createTRPCClient<AppRouter>> | null = null

// Terminal ids that live on the LOCAL daemon. Ids come from whichever daemon minted them,
// so the shared registry/store need this to know where a write, resize, or kill goes.
// Re-seeded on every roster hydrate (see useTerminalRoster), so a reload doesn't
// misroute a session that outlived the window.
const localTerminalIds = new Set<string>()
const terminalSessions = new Map<string, DaemonSession>()
const terminalClients = new Map<DaemonSession, ReturnType<typeof createAppClientFor>>()

/** Create or re-point the local session. Returns it so a caller can use it immediately. */
export function setLocalDaemonEndpoint(endpoint: DaemonEndpoint): DaemonSession {
  if (session === null) {
    session = createDaemonSession(endpoint)
    client = createAppClientFor(session)
    return session
  }
  // A no-op re-point would still tear down the socket and re-attach every PTY — the
  // `localDaemon` query refetches on focus, so this runs far more often than the daemon
  // actually moves.
  const current = session.endpoint()
  if (current.url !== endpoint.url || current.token !== endpoint.token) {
    session.setEndpoint(endpoint)
  }
  return session
}

/** The local session, or null when nothing has needed it yet. */
export function localDaemonSession(): DaemonSession | null {
  return session
}

/** The local daemon's appRouter client (roster list/rename), or null before first use. */
export function localDaemonClient(): ReturnType<typeof createTRPCClient<AppRouter>> | null {
  return client
}

export function markLocalTerminal(id: string): void {
  localTerminalIds.add(id)
}

export function forgetLocalTerminal(id: string): void {
  localTerminalIds.delete(id)
}

/** Register a terminal id with the explicit Environment session that owns it. */
export function registerTerminalSession(id: string, owner: DaemonSession): void {
  terminalSessions.set(id, owner)
}

/** Forget ownership after a terminal is closed or a roster is replaced. */
export function forgetTerminalSession(id: string): void {
  terminalSessions.delete(id)
}

/** Clear the current roster's ownership map before hydrating a new Hub target. */
export function resetTerminalSessions(): void {
  terminalSessions.clear()
}

export function isLocalTerminal(id: string): boolean {
  return localTerminalIds.has(id)
}

/**
 * Which daemon owns this terminal — the ONE place the rest of the terminal stack asks.
 * Defaults to `primary`, so every existing path (and any id we've never heard of) behaves
 * exactly as it did before local terminals existed.
 */
export function sessionForTerminal(id: string): DaemonSession {
  const explicit = terminalSessions.get(id)
  if (explicit !== undefined) return explicit
  return isLocalTerminal(id) && session !== null ? session : primary
}

/** Vanilla tRPC client for the daemon that owns one terminal id. */
export function terminalClientFor(id: string): ReturnType<typeof createAppClientFor> {
  const owner = sessionForTerminal(id)
  if (owner === primary) return trpcClient
  const existing = terminalClients.get(owner)
  if (existing !== undefined) return existing
  const created = createAppClientFor(owner)
  terminalClients.set(owner, created)
  return created
}
