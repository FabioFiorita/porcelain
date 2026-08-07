import {
  type AppEvent,
  appEventSchema,
  clientMessageSchema,
  type ServerMessage,
} from '@porcelain/contracts'
import { WebSocket } from 'ws'
import { z } from 'zod'
import {
  clearWatchedDirs,
  clearWatchedFiles,
  setWatchedDirs,
  setWatchedFiles,
} from '../fs/file-watch'
import type { AuthIdentity } from '../stores/access-store'
import { pasteImageToTerminal } from '../terminal/image-paste'
import {
  attachTerminal,
  createTerminal,
  detachSender,
  detachTerminal,
  killTerminal,
  resizeTerminal,
  writeTerminal,
} from '../terminal/terminal-manager'

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
 * scrollback). A detach never ends a PTY — but "outlives the connection" is not
 * "forever": `terminal-manager.ts` bounds an unwatched session (idle TTL + cap).
 */

const sessions = new Set<Session>()

// The `send(channel, ...args)` shuttle is untyped by design (it mirrors
// WebContents.send); re-validate the args into the typed protocol messages.
const terminalDataArgs = z.tuple([z.string(), z.string()])
const terminalExitArgs = z.tuple([z.string(), z.number()])

class Session {
  private readonly socket: WebSocket
  readonly connectedAt = Date.now()
  readonly terminals = new Set<string>()
  /** The repo this connection is looking at, if it announced one (`session:hello`). */
  repo: string | undefined

  readonly identity: AuthIdentity

  constructor(socket: WebSocket, identity: AuthIdentity) {
    this.socket = socket
    this.identity = identity
    sessions.add(this)
    socket.on('message', (raw) => this.handleMessage(raw.toString()))
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
    }
  }

  /** TerminalSender/FileWatchSender: a closed socket is a destroyed sender. */
  isDestroyed(): boolean {
    return this.socket.readyState !== WebSocket.OPEN
  }

  /** End this connection after its credential is revoked. 'close' → dispose() cleans up. */
  close(): void {
    this.socket.close(4001, 'revoked')
  }

  private push(message: ServerMessage): void {
    if (this.socket.readyState === WebSocket.OPEN) this.socket.send(JSON.stringify(message))
  }

  private handleMessage(raw: string): void {
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
        // Optional display data (which repo this client is looking at). Identity is the
        // credential the upgrade already authenticated — never anything the client says.
        this.repo = message.repo
        break
      case 'terminal:create': {
        // createTerminal throws when the daemon is at its session cap with nothing safe
        // to evict. Two things must not happen: the exception escaping this socket's
        // 'message' handler (that takes the daemon down), and the client's pending create
        // never settling. `terminal:created` carries no error channel, so we still answer
        // — with the empty id, the only "there is no session" value it can express — and
        // log the reason daemon-side. The client's optimistic row self-heals on the next
        // roster hydrate. Surfacing it would need an error field on `terminal:created`.
        let id: string
        try {
          id = createTerminal(this, {
            name: message.name,
            cwd: message.cwd,
            initialInput: message.initialInput,
            cols: message.cols,
            rows: message.rows,
          })
          this.terminals.add(id)
        } catch (error) {
          console.error('[daemon] terminal:create refused:', error)
          id = ''
        }
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
      case 'terminal:paste-image': {
        // `handleMessage` is otherwise fully synchronous; an uncaught rejection in a
        // 'message' handler takes the daemon down (the same trap `terminal:create`'s own
        // comment calls out), so the outer catch is a backstop even though
        // `pasteImageToTerminal` itself never throws.
        const { id, reqId } = message
        pasteImageToTerminal(message)
          .then((outcome) => {
            this.push({ t: 'terminal:image-pasted', reqId, id, ...outcome })
          })
          .catch(() => {
            this.push({ t: 'terminal:image-pasted', reqId, id, result: 'write-failed' })
          })
        break
      }
      case 'watch:files':
        setWatchedFiles(this, message.paths)
        break
      case 'watch:dirs':
        setWatchedDirs(this, message.paths)
        break
    }
  }

  // Phase-2 socket-close semantics: the session's watchers are cleared, but its PTYs
  // are only DETACHED — they live on so a reconnecting renderer re-attaches and replays
  // scrollback. This detach starts the idle clock in terminal-manager.ts: the PTY ends on
  // an explicit `terminal:kill`, the daemon dying, or the unwatched-session bounds.
  private dispose(): void {
    sessions.delete(this)
    clearWatchedFiles(this)
    clearWatchedDirs(this)
    detachSender(this)
  }
}

export function createSession(socket: WebSocket, identity: AuthIdentity): void {
  new Session(socket, identity)
}

/** How many clients currently hold a live /session socket on this daemon. */
export function sessionCount(): number {
  return sessions.size
}

/** How many paired-device sockets are live (the local administrator is excluded). */
export function clientSessionCount(): number {
  let count = 0
  for (const session of sessions) {
    if (session.identity.kind === 'client') count += 1
  }
  return count
}

/** Drop every live connection. PTYs remain daemon-owned and continue running. */
export function closeAllSessions(): void {
  for (const session of sessions) session.close()
}

/** Drop only sockets authenticated by one revoked client credential. */
export function closeClientSessions(clientId: string): void {
  for (const session of sessions) {
    if (session.identity.kind === 'client' && session.identity.clientId === clientId) {
      session.close()
    }
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
