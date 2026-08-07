import { randomUUID } from 'node:crypto'
import { type IPty, spawn } from 'node-pty'
import { initialInputQuietDelay, QUIET_AFTER_NEWLINE_MS } from './initial-input'
import { ScrollbackBuffer } from './scrollback-buffer'
import { terminalEnv } from './terminal-env'

// The embedded terminal's PTY layer. PTYs are OS resources, so they live here in the
// daemon process (one Map for the whole app). A PTY's lifetime is DECOUPLED from any WS
// connection: sessions survive a renderer reload, and a re-connecting (or a second)
// client attaches to the live PTY, replays its scrollback, and resumes streaming. So a
// session has no single owner sender — it has a SET of attached senders and output fans
// out to all of them. The daemon also owns the roster (name/cwd/status), so a renamed or
// still-running session reappears after a reload; a dropped socket just detaches, and
// output past the scrollback cap is forgotten (see scrollback-buffer.ts).
//
// Decoupled is not unbounded: without the three bounds below a long-lived daemon reached
// 228 sessions and an 8.7 GB peak of orphaned `zsh -l`. All are swept by `sweepTerminals`:
//   - EXITED_RETENTION_MS — a dead session's final output stays readable across a reload,
//     which is the point of keeping the entry, but not forever.
//   - DETACHED_IDLE_MS — a generous 12h: a background dev server you come back to
//     tomorrow must survive; a forgotten login shell must not.
//   - MAX_SESSIONS — the backstop against a runaway creator, spending the cheapest
//     sacrifice first and refusing rather than killing a session a human is watching.
// The bounds only ever touch a session with NO attached client. Every path that can empty
// `attached` must start the idle clock (`markDetachedIfEmpty`) — including `fanOut`, which
// drops destroyed senders — or a session detaches invisibly and never expires.

/**
 * The minimal slice of `WebContents` we need: send terminal output and check the
 * sender is still alive. Kept structural (not the electron type, same as
 * `FileWatchSender` in file-watch.ts) so this module stays Electron-free.
 */
export interface TerminalSender {
  send(channel: string, ...args: unknown[]): void
  isDestroyed(): boolean
}

/** The roster label + provenance the daemon owns and the renderer hydrates from. */
interface SessionMeta {
  name: string
  cwd: string
  createdAt: number
}

interface Session {
  pty: IPty
  meta: SessionMeta
  status: 'running' | 'exited'
  exitCode?: number
  scrollback: ScrollbackBuffer
  // Every client currently streaming this PTY. Output fans out to all; a detach (socket
  // close) removes one without touching the PTY. Empty is fine — a background dev server
  // keeps running with nobody watching until someone re-attaches.
  attached: Set<TerminalSender>
  /** When the PTY exited on its own. Set by `onExit`; undefined while running. */
  exitedAt?: number
  /** When `attached` last became empty. Undefined whenever at least one client streams. */
  detachedSince?: number
}

const sessions = new Map<string, Session>()

/** How long an exited session's final output stays replayable before it's forgotten. */
export const EXITED_RETENTION_MS = 10 * 60_000
/** How long a running session with nobody attached is kept before it's killed. */
export const DETACHED_IDLE_MS = 12 * 60 * 60_000
/** Hard ceiling on concurrent sessions in one daemon. */
export const MAX_SESSIONS = 64
const SWEEP_INTERVAL_MS = 60_000

let sweepTimer: ReturnType<typeof setInterval> | undefined

/**
 * Start the reaper on the first `createTerminal` — never at import, or every unit test
 * that pulls this module in leaks a timer. `unref` so the sweep can't be the reason the
 * daemon (or a test worker) stays alive.
 */
function startSweeping(): void {
  if (sweepTimer !== undefined) return
  sweepTimer = setInterval(() => sweepTerminals(), SWEEP_INTERVAL_MS)
  sweepTimer.unref()
}

/** Start the idle clock if `session` just lost its last attached client (idempotent). */
function markDetachedIfEmpty(session: Session, now = Date.now()): void {
  if (session.attached.size === 0) session.detachedSince ??= now
}

/** Matching sessions, oldest `createdAt` first — the eviction order under the cap. */
function oldestFirst(match: (session: Session) => boolean): [string, Session][] {
  return [...sessions]
    .filter(([, session]) => match(session))
    .sort(([, a], [, b]) => a.meta.createdAt - b.meta.createdAt)
}

/** Delete the entry BEFORE killing, so `onExit`'s guard skips the exit fan-out. */
function evict(id: string, session: Session): void {
  sessions.delete(id)
  if (session.status === 'running') session.pty.kill()
}

/**
 * Drop the sessions the bounds say are expired: an exited one whose grace period is up,
 * and a running one nobody has been attached to for `DETACHED_IDLE_MS`. Anything with an
 * attached client is left alone — an exited session someone is still reading is reaped
 * on the sweep after they detach. Takes `now` so tests drive it with explicit
 * timestamps instead of fake timers.
 */
export function sweepTerminals(now: number = Date.now()): void {
  for (const [id, session] of sessions) {
    if (session.attached.size > 0) continue
    if (session.status === 'exited') {
      if (session.exitedAt !== undefined && now - session.exitedAt > EXITED_RETENTION_MS) {
        sessions.delete(id)
      }
      continue
    }
    if (session.detachedSince !== undefined && now - session.detachedSince > DETACHED_IDLE_MS) {
      evict(id, session)
    }
  }
}

/**
 * Make room for one more PTY under `MAX_SESSIONS`, cheapest sacrifice first: the normal
 * sweep, then exited entries ahead of their grace period (their process is already gone,
 * so this only forgets scrollback), then the oldest running session nobody is watching.
 * Throws when every remaining session has an attached client — refusing beats killing a
 * terminal a human is looking at.
 */
function makeRoom(now: number): void {
  if (sessions.size < MAX_SESSIONS) return
  sweepTerminals(now)
  for (const [id] of oldestFirst((s) => s.status === 'exited' && s.attached.size === 0)) {
    if (sessions.size < MAX_SESSIONS) break
    sessions.delete(id)
  }
  const [oldestIdle] = oldestFirst((s) => s.status === 'running' && s.attached.size === 0)
  if (sessions.size >= MAX_SESSIONS && oldestIdle !== undefined) {
    evict(oldestIdle[0], oldestIdle[1])
  }
  if (sessions.size >= MAX_SESSIONS) {
    throw new Error(
      `Cannot open another terminal: all ${MAX_SESSIONS} sessions are in use by a connected client. Close one first.`,
    )
  }
}

/** One roster row: the daemon-owned metadata the renderer's sidebar list renders. */
export interface TerminalInfo {
  id: string
  name: string
  cwd: string
  status: 'running' | 'exited'
  exitCode?: number
  createdAt: number
}

export interface CreateTerminalOptions {
  /** The roster label — the daemon owns the roster now, so the creator passes it in. */
  name: string
  cwd: string
  /** Typed into the fresh shell once (e.g. an action's command); runs as if the user typed it. */
  initialInput?: string
  cols?: number
  rows?: number
}

/**
 * The user's login shell, falling back to zsh (macOS default). `PORCELAIN_SHELL`
 * overrides it — an escape hatch, and how the e2e suite pins a deterministic shell.
 */
function defaultShell(): string {
  const override = process.env.PORCELAIN_SHELL
  if (override && override.trim() !== '') return override
  return process.env.SHELL && process.env.SHELL.trim() !== '' ? process.env.SHELL : '/bin/zsh'
}

/** Fan a `send` out to every still-alive attached sender, dropping destroyed ones. */
function fanOut(session: Session, channel: string, ...args: unknown[]): void {
  for (const sender of session.attached) {
    if (sender.isDestroyed()) session.attached.delete(sender)
    else sender.send(channel, ...args)
  }
  // Dropping the last destroyed sender is a detach too — a socket that died without a
  // close (the common remote case) must start the idle clock, not stall it forever.
  markDetachedIfEmpty(session)
}

/**
 * Spawn an interactive login shell (so the user's PATH/aliases are present) in `cwd`
 * and stream its output to every attached sender over `terminal:data`. An action runs by
 * typing its command into this same shell (`initialInput`), so the terminal stays live
 * afterwards — Ctrl-C, re-run, keep working — instead of dying when the command exits.
 * The creator is auto-attached; the returned id is how any client re-attaches later.
 * Throws when the daemon is at `MAX_SESSIONS` and nothing is safe to evict.
 */
export function createTerminal(sender: TerminalSender, opts: CreateTerminalOptions): string {
  makeRoom(Date.now())
  startSweeping()
  const id = randomUUID()
  const pty = spawn(defaultShell(), ['-l'], {
    name: 'xterm-256color',
    cols: opts.cols ?? 80,
    rows: opts.rows ?? 24,
    cwd: opts.cwd,
    // terminalEnv strips the daemon-only vars (session token, RUN_AS_NODE, …)
    // so no secret or process-mode flag leaks into a user shell — see terminal-env.ts.
    env: terminalEnv(process.env),
  })
  const session: Session = {
    pty,
    meta: { name: opts.name, cwd: opts.cwd, createdAt: Date.now() },
    status: 'running',
    scrollback: new ScrollbackBuffer(),
    attached: new Set([sender]),
  }
  sessions.set(id, session)

  // Race: initialInput written before the shell's readline has prepped the tty is echoed
  // at the tty level but SWALLOWED (readline's prep flushes queued typeahead) — the
  // command never runs. `initial-input.ts` owns the quiet-window rule and the failures
  // behind it; here the write is a one-shot closure that whichever timer fires
  // calls-and-nulls, with killTerminal/onExit nulling it so a session gone before the
  // write never fires it. The onData scrollback/fan-out below is untouched — this rides
  // in front.
  let initialTimer: ReturnType<typeof setTimeout> | undefined
  let sendInitialInput: (() => void) | null = null
  if (opts.initialInput !== undefined && opts.initialInput !== '') {
    const input = opts.initialInput
    sendInitialInput = (): void => {
      if (initialTimer !== undefined) clearTimeout(initialTimer)
      sendInitialInput = null
      if (sessions.has(id)) pty.write(`${input}\r`)
    }
    initialTimer = setTimeout(() => sendInitialInput?.(), QUIET_AFTER_NEWLINE_MS)
  }

  pty.onData((data) => {
    if (sendInitialInput !== null) {
      if (initialTimer !== undefined) clearTimeout(initialTimer)
      initialTimer = setTimeout(() => sendInitialInput?.(), initialInputQuietDelay(data))
    }
    session.scrollback.append(data)
    fanOut(session, 'terminal:data', id, data)
  })
  pty.onExit(({ exitCode }) => {
    // A session that exits before the initialInput write must never fire it.
    if (initialTimer !== undefined) clearTimeout(initialTimer)
    sendInitialInput = null
    // Explicit killTerminal deletes the map entry BEFORE pty.kill() — don't fan out
    // exit for those (the renderer already dropped the row; a late terminal:exit was
    // racing hydrate and briefly resurfacing the session as "exited").
    if (!sessions.has(id)) return
    // Natural exit (shell `exit`, Ctrl-D, …): keep the entry so final output stays
    // readable across reloads — the sweep forgets it EXITED_RETENTION_MS later (or
    // killTerminal removes it now). Mark exited so a re-attach shows the exited state.
    session.status = 'exited'
    session.exitCode = exitCode
    session.exitedAt = Date.now()
    fanOut(session, 'terminal:exit', id, exitCode)
  })

  return id
}

/**
 * Attach `sender` to a live session and return its replay snapshot, or null for an
 * unknown id. The attach reply carries the scrollback and is sent before any subsequent
 * `terminal:data`, so a client can safely write the snapshot into its xterm first and
 * then let live output follow.
 */
export function attachTerminal(
  id: string,
  sender: TerminalSender,
): { scrollback: string; status: 'running' | 'exited'; exitCode?: number } | null {
  const session = sessions.get(id)
  if (!session) return null
  session.attached.add(sender)
  // Somebody is watching again: stop the idle-detach clock (a session re-attached before
  // the TTL must survive, and the next detach starts a fresh 12h).
  session.detachedSince = undefined
  return {
    scrollback: session.scrollback.snapshot(),
    status: session.status,
    exitCode: session.exitCode,
  }
}

/** Stop streaming ONE session to `sender` WITHOUT killing it (the PTY lives on). */
export function detachTerminal(id: string, sender: TerminalSender): void {
  const session = sessions.get(id)
  if (session === undefined) return
  session.attached.delete(sender)
  markDetachedIfEmpty(session)
}

/** Remove `sender` from every session WITHOUT killing — called when its socket closes. */
export function detachSender(sender: TerminalSender): void {
  for (const session of sessions.values()) {
    session.attached.delete(sender)
    markDetachedIfEmpty(session)
  }
}

/** The roster the renderer hydrates its sidebar list from. */
export function listTerminals(): TerminalInfo[] {
  return [...sessions.entries()].map(([id, session]) => ({
    id,
    name: session.meta.name,
    cwd: session.meta.cwd,
    status: session.status,
    exitCode: session.exitCode,
    createdAt: session.meta.createdAt,
  }))
}

/** Rename a session's roster label (trimmed; empty and unknown ids are ignored). */
export function renameTerminal(id: string, name: string): void {
  const trimmed = name.trim()
  if (trimmed === '') return
  const session = sessions.get(id)
  if (session) session.meta.name = trimmed
}

export function writeTerminal(id: string, data: string): void {
  sessions.get(id)?.pty.write(data)
}

/** Whether `id` is a session the daemon currently knows about (running or exited). */
export function hasTerminal(id: string): boolean {
  return sessions.has(id)
}

export function resizeTerminal(id: string, cols: number, rows: number): void {
  // node-pty throws on non-positive dimensions (a hidden/zero-size pane reports 0).
  if (cols <= 0 || rows <= 0) return
  sessions.get(id)?.pty.resize(cols, rows)
}

/**
 * Explicitly end a session — the Terminal list's close button. Kills the PTY if it's
 * still running and removes the entry entirely; killing an already-exited entry just
 * removes it. The only OTHER things that end a PTY are the daemon process dying and the
 * bounds at the top of this file, neither of which can touch an attached session.
 */
export function killTerminal(id: string): void {
  const session = sessions.get(id)
  if (!session) return
  evict(id, session)
}
