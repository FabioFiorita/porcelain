import { randomUUID } from 'node:crypto'
import type { WebContents } from 'electron'
import { type IPty, spawn } from 'node-pty'

// The embedded terminal's PTY layer. PTYs are OS resources, so they live here in the
// main process (one Map for the whole app); the renderer drives them over the
// dedicated `terminal` IPC bridge (preload), NOT tRPC — a terminal streams bytes both
// ways at high frequency, which the request/response transport and the one-way
// app-event channel both fit poorly. Each PTY remembers the WebContents that opened it
// so its output goes back to the right window and all of a window's PTYs die with it.

interface Session {
  pty: IPty
  sender: WebContents
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

function cleanEnv(): Record<string, string> {
  const env: Record<string, string> = {}
  for (const [key, value] of Object.entries(process.env)) {
    if (value !== undefined) env[key] = value
  }
  env.TERM = 'xterm-256color'
  env.COLORTERM = 'truecolor'
  return env
}

/**
 * Spawn an interactive login shell (so the user's PATH/aliases are present) in `cwd`
 * and stream its output to `sender` over `terminal:data`. An action runs by typing its
 * command into this same shell (`initialInput`), so the terminal stays live afterwards
 * — Ctrl-C, re-run, keep working — instead of dying when the command exits.
 */
export function createTerminal(sender: WebContents, opts: CreateTerminalOptions): string {
  const id = randomUUID()
  const pty = spawn(defaultShell(), ['-l'], {
    name: 'xterm-256color',
    cols: opts.cols ?? 80,
    rows: opts.rows ?? 24,
    cwd: opts.cwd,
    env: cleanEnv(),
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
export function killTerminalsForSender(sender: WebContents): void {
  for (const [id, session] of sessions) {
    if (session.sender === sender) {
      sessions.delete(id)
      session.pty.kill()
    }
  }
}
