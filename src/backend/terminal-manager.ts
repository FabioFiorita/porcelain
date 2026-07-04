import { randomUUID } from 'node:crypto'
import { type IPty, spawn } from 'node-pty'
import { terminalEnv } from './terminal-env'

// The embedded terminal's PTY layer. PTYs are OS resources, so they live here in the
// main process (one Map for the whole app); the renderer drives them over the
// dedicated `terminal` IPC bridge (preload), NOT tRPC — a terminal streams bytes both
// ways at high frequency, which the request/response transport and the one-way
// app-event channel both fit poorly. Each PTY remembers the sender that opened it
// so its output goes back to the right window and all of a window's PTYs die with it.

/**
 * The minimal slice of `WebContents` we need: send terminal output and check the
 * window is still alive. Kept structural (not the electron type, same as
 * `FileWatchSender` in file-watch.ts) so this module stays Electron-free.
 */
export interface TerminalSender {
  send(channel: string, ...args: unknown[]): void
  isDestroyed(): boolean
}

interface Session {
  pty: IPty
  sender: TerminalSender
}

const sessions = new Map<string, Session>()

export interface CreateTerminalOptions {
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

/**
 * Spawn an interactive login shell (so the user's PATH/aliases are present) in `cwd`
 * and stream its output to `sender` over `terminal:data`. An action runs by typing its
 * command into this same shell (`initialInput`), so the terminal stays live afterwards
 * — Ctrl-C, re-run, keep working — instead of dying when the command exits.
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
  sessions.set(id, { pty, sender })

  pty.onData((data) => {
    if (!sender.isDestroyed()) sender.send('terminal:data', id, data)
  })
  pty.onExit(({ exitCode }) => {
    sessions.delete(id)
    if (!sender.isDestroyed()) sender.send('terminal:exit', id, exitCode)
  })

  if (opts.initialInput !== undefined && opts.initialInput !== '') {
    pty.write(`${opts.initialInput}\r`)
  }
  return id
}

export function writeTerminal(id: string, data: string): void {
  sessions.get(id)?.pty.write(data)
}

export function resizeTerminal(id: string, cols: number, rows: number): void {
  // node-pty throws on non-positive dimensions (a hidden/zero-size pane reports 0).
  if (cols <= 0 || rows <= 0) return
  sessions.get(id)?.pty.resize(cols, rows)
}

export function killTerminal(id: string): void {
  const session = sessions.get(id)
  if (!session) return
  sessions.delete(id)
  session.pty.kill()
}

/** Kill every PTY a window owns — called when that window closes. */
export function killTerminalsForSender(sender: TerminalSender): void {
  for (const [id, session] of sessions) {
    if (session.sender === sender) {
      sessions.delete(id)
      session.pty.kill()
    }
  }
}
