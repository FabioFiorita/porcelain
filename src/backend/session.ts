import { WebSocket } from 'ws'
import { z } from 'zod'
import { agentEventSchema } from '../shared/agent-protocol'
import {
  type AppEvent,
  appEventSchema,
  clientMessageSchema,
  type ServerMessage,
} from '../shared/ws-protocol'
import {
  abortTurn,
  attachThread,
  cancelQueued,
  detachAgentSender,
  detachThread,
  respondApproval,
  sendMessage,
} from './agents/agent-manager'
import { clearWatchedDirs, clearWatchedFiles, setWatchedDirs, setWatchedFiles } from './file-watch'
import {
  attachTerminal,
  createTerminal,
  detachSender,
  detachTerminal,
  killTerminal,
  resizeTerminal,
  writeTerminal,
} from './terminal-manager'

/**
 * Per-connection state for the daemon's WS session channel — the replacement for
 * everything the Electron shell used to key by `WebContents`. One session per
 * window: it carries app-event pushes out and terminal/watch messages in, all
 * zod-validated (`ws-protocol.ts`) because the socket is an external input.
 *
 * A session IS the structural sender that `file-watch.ts` (FileWatchSender) and
 * `terminal-manager.ts` (TerminalSender) expect: their `send(channel, ...args)`
 * calls are translated into typed WS messages here, so those modules didn't
 * change when the transport did. On socket close the session clears its file/dir
 * watchers and DETACHES from every terminal — but the PTYs live on (Phase 2:
 * sessions outlive connections, so a renderer reload re-attaches and replays
 * scrollback). Only an explicit `terminal:kill` ends a PTY.
 */

const sessions = new Set<Session>()

// The `send(channel, ...args)` shuttle is untyped by design (it mirrors
// WebContents.send); re-validate the args into the typed protocol messages.
const terminalDataArgs = z.tuple([z.string(), z.string()])
const terminalExitArgs = z.tuple([z.string(), z.number()])
const agentEventArgs = z.tuple([z.string(), agentEventSchema])

class Session {
  private readonly socket: WebSocket
  /** The paired device this socket authenticated as; null = the shared token. */
  readonly deviceId: string | null
  readonly connectedAt = Date.now()
  /** What this connection is doing, for the device roster (Settings → Environments). */
  readonly terminals = new Set<string>()
  readonly threads = new Set<string>()
  /** The repo this connection is looking at, if it announced one (`session:hello`). */
  repo: string | undefined

  constructor(socket: WebSocket, deviceId: string | null) {
    this.socket = socket
    this.deviceId = deviceId
    sessions.add(this)
    // Some handlers (agent attach/send/…) hit the disk-backed thread store, so
    // handleMessage is async; the socket callback can't await it, so swallow a
    // rejection rather than crash the daemon on an unhandled promise.
    socket.on('message', (raw) => {
      this.handleMessage(raw.toString()).catch(() => {})
    })
    // 'close' always follows 'error'; the empty error listener just keeps an
    // abruptly-dropped socket from crashing the daemon with an unhandled 'error'.
    socket.on('error', () => {})
    socket.on('close', () => this.dispose())
  }

  /** TerminalSender/FileWatchSender: translate a `send` into a protocol message. */
  send(channel: string, ...args: unknown[]): void {
    switch (channel) {
      case 'app-event': {
        this.push({ t: 'app-event', event: appEventSchema.parse(args[0]) })
        break
      }
      case 'terminal:data': {
        const [id, data] = terminalDataArgs.parse(args)
        this.push({ t: 'terminal:data', id, data })
        break
      }
      case 'terminal:exit': {
        const [id, exitCode] = terminalExitArgs.parse(args)
        this.push({ t: 'terminal:exit', id, exitCode })
        break
      }
      case 'agent:event': {
        const [threadId, event] = agentEventArgs.parse(args)
        this.push({ t: 'agent:event', threadId, event })
        break
      }
    }
  }

  /** TerminalSender/FileWatchSender: a closed socket is a destroyed sender. */
  isDestroyed(): boolean {
    return this.socket.readyState !== WebSocket.OPEN
  }

  /** End this connection (the device was revoked). 'close' fires → dispose() cleans up. */
  close(): void {
    this.socket.close(4001, 'revoked')
  }

  private push(message: ServerMessage): void {
    if (this.socket.readyState === WebSocket.OPEN) this.socket.send(JSON.stringify(message))
  }

  private async handleMessage(raw: string): Promise<void> {
    let json: unknown
    try {
      json = JSON.parse(raw)
    } catch {
      return
    }
    // An external process owns the other end of the socket in principle (it's a
    // network input, even on loopback) — drop anything that doesn't validate.
    const parsed = clientMessageSchema.safeParse(json)
    if (!parsed.success) return
    const message = parsed.data
    switch (message.t) {
      case 'session:hello':
        // Display data for the device roster; never trusted for identity (see ws-protocol).
        this.repo = message.repo
        break
      case 'terminal:create': {
        const id = createTerminal(this, {
          name: message.name,
          cwd: message.cwd,
          initialInput: message.initialInput,
          cols: message.cols,
          rows: message.rows,
        })
        this.terminals.add(id)
        this.push({ t: 'terminal:created', reqId: message.reqId, id })
        break
      }
      case 'terminal:attach': {
        // null (unknown id) → reply found=false with an empty snapshot so the client's
        // pending attach still settles instead of hanging.
        const result = attachTerminal(message.id, this)
        if (result !== null) this.terminals.add(message.id)
        this.push({
          t: 'terminal:attached',
          reqId: message.reqId,
          id: message.id,
          scrollback: result?.scrollback ?? '',
          status: result?.status ?? 'exited',
          exitCode: result?.exitCode,
          found: result !== null,
        })
        break
      }
      case 'terminal:detach':
        detachTerminal(message.id, this)
        this.terminals.delete(message.id)
        break
      case 'terminal:write':
        writeTerminal(message.id, message.data)
        break
      case 'terminal:resize':
        resizeTerminal(message.id, message.cols, message.rows)
        break
      case 'terminal:kill':
        killTerminal(message.id)
        this.terminals.delete(message.id)
        break
      case 'watch:files':
        setWatchedFiles(this, message.paths)
        break
      case 'watch:dirs':
        setWatchedDirs(this, message.paths)
        break
      case 'agent:attach': {
        // Mirror terminal:attach — found=false with an empty snapshot for an unknown
        // id so the client's pending attach still settles.
        const result = await attachThread(message.threadId, this)
        if (result.found) this.threads.add(message.threadId)
        this.push({
          t: 'agent:attached',
          reqId: message.reqId,
          threadId: message.threadId,
          found: result.found,
          items: result.items,
          status: result.status,
        })
        break
      }
      case 'agent:detach':
        detachThread(message.threadId, this)
        this.threads.delete(message.threadId)
        break
      case 'agent:send':
        await sendMessage(message.threadId, {
          text: message.text,
          images: message.images,
          thumbnails: message.thumbnails,
        })
        break
      case 'agent:abort':
        await abortTurn(message.threadId)
        break
      case 'agent:cancel-queued':
        await cancelQueued(message.threadId, message.index)
        break
      case 'agent:approve':
        await respondApproval(message.threadId, message.requestId, message.decision)
        break
    }
  }

  // Phase-2 socket-close semantics: the session's watchers are cleared, but its PTYs
  // are only DETACHED — they live on so a reconnecting renderer re-attaches and replays
  // scrollback. A PTY ends only on an explicit `terminal:kill` (or the daemon dying).
  private dispose(): void {
    sessions.delete(this)
    clearWatchedFiles(this)
    clearWatchedDirs(this)
    detachSender(this)
    detachAgentSender(this)
  }
}

export function createSession(socket: WebSocket, deviceId: string | null = null): void {
  new Session(socket, deviceId)
}

/** One live connection, as the device roster sees it. */
export interface SessionInfo {
  deviceId: string | null
  connectedAt: number
  repo?: string
  terminals: number
  threads: number
}

/** Every live connection — the "what is this device doing right now" half of the roster. */
export function listSessions(): SessionInfo[] {
  return [...sessions].map((session) => ({
    deviceId: session.deviceId,
    connectedAt: session.connectedAt,
    repo: session.repo,
    terminals: session.terminals.size,
    threads: session.threads.size,
  }))
}

/**
 * Drop every live connection belonging to a revoked device. Without this, revoking would
 * only stop the NEXT request: an already-upgraded socket keeps streaming terminals and
 * agent turns, because the gate ran at upgrade time. Its PTYs and threads live on (they're
 * daemon-owned) — this ends the device's access to them, not the work.
 */
export function closeSessionsForDevice(deviceId: string): void {
  for (const session of sessions) {
    if (session.deviceId === deviceId) session.close()
  }
}

/**
 * Fan an app event out to every session — wired to `subscribeAppEvents` once at
 * daemon boot (server.ts). Only the agent-channel events flow through here;
 * `working-tree`/`file-tree` are sent targeted by file-watch via `Session.send`.
 */
export function broadcastAppEvent(event: AppEvent): void {
  for (const session of sessions) session.send('app-event', event)
}
