import { randomUUID } from 'node:crypto'
import { type IPty, spawn } from 'node-pty'
import { ScrollbackBuffer } from './scrollback-buffer'
import { terminalEnv } from './terminal-env'

// The embedded terminal's PTY layer. PTYs are OS resources, so they live here in the
// daemon process (one Map for the whole app). As of Phase 2 a PTY's lifetime is
// DECOUPLED from any WS connection: sessions survive a renderer reload, and a
// re-connecting (or a second) client attaches to the live PTY, replays its scrollback,
// and resumes streaming. So a session has no single owner sender — it has a SET of
// attached senders and output fans out to all of them. The daemon also owns the roster
// (name/cwd/status): the renderer hydrates its sidebar list from `listTerminals`, so a
// renamed or still-running session reappears after a reload. Only an explicit
// `killTerminal` (the Terminal list's close button) or the daemon process dying ends a
// PTY — a dropped socket just detaches. Output past the scrollback cap is forgotten
// (see scrollback-buffer.ts) so a long-lived shell can't grow daemon memory unbounded.

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
}

const sessions = new Map<string, Session>()

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
}

/**
 * Spawn an interactive login shell (so the user's PATH/aliases are present) in `cwd`
 * and stream its output to every attached sender over `terminal:data`. An action runs by
 * typing its command into this same shell (`initialInput`), so the terminal stays live
 * afterwards — Ctrl-C, re-run, keep working — instead of dying when the command exits.
 * The creator is auto-attached; the returned id is how any client re-attaches later.
 */
export function createTerminal(sender: TerminalSender, opts: CreateTerminalOptions): string {
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

  // Race: initialInput written right after spawn() (before the shell finishes readline
  // init) is echoed at the tty level but SWALLOWED when the shell takes over its input —
  // the command never runs. This failed two release gates (v0.17.1, v0.19.0) as a phantom
  // "flake": on a slow runner the echoed line landed ABOVE bash's "default shell is zsh"
  // banner and produced no output. So we don't write at spawn — we write once on the
  // shell's FIRST output (its banner/prompt = readline is up), with a 2s fallback for a
  // shell configured to print nothing on startup. A one-shot closure that whichever fires
  // first calls-and-nulls; killTerminal/onExit null it so a session gone before the write
  // never fires it. The onData scrollback/fan-out below is untouched — this rides in front.
  let initialTimer: ReturnType<typeof setTimeout> | undefined
  let sendInitialInput: (() => void) | null = null
  if (opts.initialInput !== undefined && opts.initialInput !== '') {
    const input = opts.initialInput
    sendInitialInput = () => {
      if (initialTimer !== undefined) clearTimeout(initialTimer)
      sendInitialInput = null
      if (sessions.has(id)) pty.write(`${input}\r`)
    }
    initialTimer = setTimeout(() => sendInitialInput?.(), 2000)
  }

  pty.onData((data) => {
    sendInitialInput?.()
    session.scrollback.append(data)
    fanOut(session, 'terminal:data', id, data)
  })
  pty.onExit(({ exitCode }) => {
    // A session that exits before the initialInput write must never fire it.
    if (initialTimer !== undefined) clearTimeout(initialTimer)
    sendInitialInput = null
    // Keep the entry (its final output stays readable across reloads) — only an explicit
    // killTerminal removes it. Mark it exited so a re-attach shows the exited state.
    session.status = 'exited'
    session.exitCode = exitCode
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
  return {
    scrollback: session.scrollback.snapshot(),
    status: session.status,
    exitCode: session.exitCode,
  }
}

/** Stop streaming ONE session to `sender` WITHOUT killing it (the PTY lives on). */
export function detachTerminal(id: string, sender: TerminalSender): void {
  sessions.get(id)?.attached.delete(sender)
}

/** Remove `sender` from every session WITHOUT killing — called when its socket closes. */
export function detachSender(sender: TerminalSender): void {
  for (const session of sessions.values()) session.attached.delete(sender)
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

export function resizeTerminal(id: string, cols: number, rows: number): void {
  // node-pty throws on non-positive dimensions (a hidden/zero-size pane reports 0).
  if (cols <= 0 || rows <= 0) return
  sessions.get(id)?.pty.resize(cols, rows)
}

/**
 * Explicitly end a session — the Terminal list's close button. Kills the PTY if it's
 * still running and removes the entry entirely; killing an already-exited entry just
 * removes it. This is the ONLY thing (besides the daemon process dying) that ends a PTY.
 */
export function killTerminal(id: string): void {
  const session = sessions.get(id)
  if (!session) return
  sessions.delete(id)
  if (session.status === 'running') session.pty.kill()
}
