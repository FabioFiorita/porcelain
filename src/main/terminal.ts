import { type IPty, spawn } from 'node-pty'

interface TerminalSession {
  pty: IPty
  listeners: Set<(data: string) => void>
  scrollback: string
}

const MAX_SCROLLBACK = 256 * 1024

const sessions = new Map<string, TerminalSession>()
let nextId = 0

export function createTerminal(cwd: string): string {
  const id = `term-${nextId++}`
  const shell = process.env['SHELL'] ?? '/bin/zsh'
  const pty = spawn(shell, [], {
    name: 'xterm-256color',
    cwd,
    cols: 80,
    rows: 24,
    env: process.env as Record<string, string>,
  })

  const session: TerminalSession = { pty, listeners: new Set(), scrollback: '' }
  pty.onData((data) => {
    session.scrollback = (session.scrollback + data).slice(-MAX_SCROLLBACK)
    for (const listener of session.listeners) listener(data)
  })
  pty.onExit(() => {
    sessions.delete(id)
  })

  sessions.set(id, session)
  return id
}

export function terminalScrollback(id: string): string {
  return sessions.get(id)?.scrollback ?? ''
}

export function subscribeTerminal(id: string, listener: (data: string) => void): () => void {
  const session = sessions.get(id)
  if (!session) return () => {}
  session.listeners.add(listener)
  return () => session.listeners.delete(listener)
}

export function writeTerminal(id: string, data: string): void {
  sessions.get(id)?.pty.write(data)
}

export function resizeTerminal(id: string, cols: number, rows: number): void {
  sessions.get(id)?.pty.resize(cols, rows)
}

export function hasTerminal(id: string): boolean {
  return sessions.has(id)
}

export function killAllTerminals(): void {
  for (const [id, session] of sessions) {
    session.pty.kill()
    sessions.delete(id)
  }
}
