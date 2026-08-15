import { isAbsolute } from 'node:path'
import type { SessionChange } from '@porcelain/contracts/session'
import type { DevServer, DevServersInput, StartDevServerInput } from '@porcelain/contracts/terminal'
import { detectServerUrl } from './dev-server-url'
import type {
  DevServerHost,
  DevServerOperations,
  TerminalClock,
  TerminalFailure,
  TerminalResult,
} from './terminal-ports'

/**
 * Development-server records: the daemon's answer to "what is still running for this work?"
 *
 * The record — not the client, not the Viewer tab — owns the process. Detaching, switching
 * Worktree, reloading the browser, and closing the window all leave this map untouched;
 * `stop` is the only thing that ends a process, and `dismiss` the only thing that forgets a
 * finished one. Records live in memory on purpose: the daemon dying ends the processes too,
 * so a persisted record could only ever describe a process that no longer exists.
 */

/** A finished record is kept a full day so tomorrow's "why did it die?" still has an answer. */
export const DEV_SERVER_EXITED_RETENTION_MS = 24 * 60 * 60_000

/** How much output is worth scanning for a URL before giving up. Startup banners are early. */
const URL_SCAN_BYTES = 16 * 1024

type Record_ = {
  record: DevServer
  scanned: number
  urlFound: boolean
}

type CreateDevServerOperationsOptions = Readonly<{
  host: DevServerHost
  publish: (change: SessionChange) => void
  clock: TerminalClock
  ids: Readonly<{ create(): string }>
}>

function failure(code: TerminalFailure['code']): TerminalResult<never> {
  return { ok: false, error: { code } }
}

export function createDevServerOperations(
  options: CreateDevServerOperationsOptions,
): DevServerOperations {
  const { clock, host, ids, publish } = options
  const servers = new Map<string, Record_>()

  function announce(server: DevServer): void {
    publish({
      kind: 'terminal.dev-servers-changed',
      projectPath: server.target.path,
      projectId: server.target.projectId,
      worktreeId: server.target.worktreeId,
    })
  }

  /** Drop finished records nobody dismissed, so a long-lived daemon cannot grow forever. */
  function expire(now: number): void {
    for (const [id, entry] of servers) {
      const { endedAt } = entry.record
      if (endedAt === undefined) continue
      if (now - endedAt > DEV_SERVER_EXITED_RETENTION_MS) {
        servers.delete(id)
        host.kill(entry.record.terminalId)
      }
    }
  }

  function list(input: DevServersInput): DevServer[] {
    expire(clock.now())
    const wanted = input.target
    return [...servers.values()]
      .map((entry) => entry.record)
      .filter(
        (server) =>
          wanted === undefined ||
          (server.target.projectId === wanted.projectId &&
            server.target.worktreeId === wanted.worktreeId),
      )
      .sort((first, second) => first.createdAt - second.createdAt)
  }

  function observe(id: string): {
    onCommandSent: () => void
    onData: (data: string) => void
    onExit: (exitCode: number) => void
  } {
    return {
      onCommandSent: () => {
        const entry = servers.get(id)
        if (entry === undefined || entry.record.status !== 'starting') return
        entry.record = { ...entry.record, status: 'running', startedAt: clock.now() }
        announce(entry.record)
      },
      onData: (data) => {
        const entry = servers.get(id)
        if (entry === undefined || entry.urlFound || entry.scanned >= URL_SCAN_BYTES) return
        entry.scanned += data.length
        const url = detectServerUrl(data)
        if (url === null) return
        entry.urlFound = true
        entry.record = { ...entry.record, detectedUrl: url }
        announce(entry.record)
      },
      onExit: (exitCode) => {
        const entry = servers.get(id)
        // `stop` already wrote the terminal state; the PTY's own exit must not overwrite it.
        if (entry === undefined || entry.record.endedAt !== undefined) return
        entry.record = { ...entry.record, status: 'exited', exitCode, endedAt: clock.now() }
        announce(entry.record)
      },
    }
  }

  function start(input: StartDevServerInput): TerminalResult<DevServer> {
    // The target is explicit or there is no start. A relative or empty checkout path is the
    // shape a caller produces when it guessed, so it is rejected rather than resolved.
    if (!isAbsolute(input.target.path)) return failure('terminal.dev-server-target')
    const id = ids.create()
    const now = clock.now()
    const spawned = host.createRetained(
      { name: input.label, cwd: input.target.path, initialInput: input.command },
      observe(id),
    )
    if (!spawned.ok) return spawned
    const record: DevServer = {
      id,
      target: input.target,
      label: input.label,
      command: input.command,
      cwd: input.target.path,
      status: 'starting',
      terminalId: spawned.value,
      createdAt: now,
      startedAt: now,
    }
    servers.set(id, { record, scanned: 0, urlFound: false })
    announce(record)
    return { ok: true, value: record }
  }

  function stop(id: string): TerminalResult<DevServer> {
    const entry = servers.get(id)
    if (entry === undefined) return failure('terminal.dev-server-not-found')
    if (entry.record.endedAt !== undefined) return { ok: true, value: entry.record }
    host.kill(entry.record.terminalId)
    entry.record = { ...entry.record, status: 'stopped', endedAt: clock.now() }
    announce(entry.record)
    return { ok: true, value: entry.record }
  }

  function dismiss(id: string): TerminalResult<void> {
    const entry = servers.get(id)
    if (entry === undefined) return failure('terminal.dev-server-not-found')
    // Forgetting a live record would orphan its process with no way back to it.
    if (entry.record.endedAt === undefined) return failure('terminal.dev-server-running')
    servers.delete(id)
    host.kill(entry.record.terminalId)
    announce(entry.record)
    return { ok: true, value: undefined }
  }

  return Object.freeze({ list, start, stop, dismiss })
}
