import {
  MIN_RETRY_MS,
  nextRetryDelay,
  parseServerMessage,
  REQUEST_TIMEOUT_MS,
  REVOKED_CLOSE_CODE,
  reconnectDelayMs,
  sessionSubprotocol,
  sessionWebSocketUrl,
  unionWatchPaths,
} from '@porcelain/client-runtime/session-protocol'
import type { ClientMessage, ServerMessage } from '@porcelain/contracts'
import { useMemo, useSyncExternalStore } from 'react'

import { DaemonError } from './errors'

// Exported through `DaemonSession['status']` until a surface names it directly.
type SessionStatus = 'idle' | 'connecting' | 'open' | 'reconnecting'

export type SessionEndpoint = { baseUrl: string; token: string; repo: string | null }

export type DaemonSession = {
  readonly status: SessionStatus
  send(message: ClientMessage): void
  /** Returns an unsubscribe. Registering the first listener lazily opens the socket. */
  subscribe(listener: (message: ServerMessage) => void): () => void
  /** Fires after every successful (re)connect, once hello has been re-sent. */
  onReconnect(handler: () => void): () => void
  /**
   * Fires after every successful connect INCLUDING the first — `onReconnect` deliberately
   * skips that one. Anything that must not be pushed into a socket still in `connecting`
   * (a terminal create/attach, which correlates a reply by `reqId` and would otherwise
   * time out against a dropped frame) waits on this instead.
   */
  onOpen(handler: () => void): () => void
  watch(paths: { files?: readonly string[]; dirs?: readonly string[] }): () => void
  request<TReply extends ServerMessage>(
    message: ClientMessage,
    match: (frame: ServerMessage) => TReply | null,
    options?: { timeoutMs?: number },
  ): Promise<TReply>
}

const listeners = new Set<(message: ServerMessage) => void>()
const reconnectHandlers = new Set<() => void>()
const openHandlers = new Set<() => void>()
const statusListeners = new Set<() => void>()
const watches = new Map<symbol, { files: readonly string[]; dirs: readonly string[] }>()

let endpoint: SessionEndpoint | null = null
let socket: WebSocket | null = null
let status: SessionStatus = 'idle'
let everConnected = false
let wanted = false
let foreground = true
let retryDelay: number = MIN_RETRY_MS
let retryTimer: ReturnType<typeof setTimeout> | null = null
let onClosed: ((reason: SessionCloseReason) => Promise<void> | void) | null = null
const pendingRejects = new Set<(error: DaemonError) => void>()

function setStatus(next: SessionStatus): void {
  if (status === next) return
  status = next
  for (const listener of statusListeners) listener()
}

function push(message: ClientMessage): void {
  if (socket !== null && socket.readyState === 1) socket.send(JSON.stringify(message))
}

function dispatch(frame: ServerMessage): void {
  for (const listener of [...listeners]) listener(frame)
}

/** `revoked` is the daemon's own verdict; `refused` needs an authenticated HTTP probe. */
export type SessionCloseReason = 'revoked' | 'refused'

function failPending(message: string): void {
  const rejects = [...pendingRejects]
  pendingRejects.clear()
  for (const reject of rejects) reject(new DaemonError('unreachable', 'session', message))
}

function scheduleReconnect(): void {
  if (retryTimer !== null || !wanted || !foreground) return
  retryTimer = setTimeout(() => {
    retryTimer = null
    open()
  }, reconnectDelayMs(retryDelay))
  retryDelay = nextRetryDelay(retryDelay)
  setStatus('reconnecting')
}

function open(): void {
  if (endpoint === null || !wanted || !foreground) return
  if (socket !== null && (socket.readyState === 0 || socket.readyState === 1)) return

  const { baseUrl, token, repo } = endpoint
  // The token rides as the requested subprotocol — the one header a WebSocket can carry, and
  // the reason it never lands in a query string a proxy would log.
  const ws = new WebSocket(sessionWebSocketUrl(baseUrl), [sessionSubprotocol(token)])
  socket = ws
  setStatus(everConnected ? 'reconnecting' : 'connecting')

  ws.onopen = (): void => {
    if (socket !== ws) return
    retryDelay = MIN_RETRY_MS
    // Session state is per-socket daemon-side: hello and every watch start over on each open.
    push({ t: 'session:hello', repo: repo ?? undefined })
    const { files, dirs } = unionWatchPaths(watches.values())
    if (files.length > 0) push({ t: 'watch:files', paths: files })
    if (dirs.length > 0) push({ t: 'watch:dirs', paths: dirs })
    setStatus('open')
    if (everConnected) for (const handler of [...reconnectHandlers]) handler()
    everConnected = true
    for (const handler of [...openHandlers]) handler()
  }

  ws.onmessage = (event: WebSocketMessageEvent): void => {
    if (typeof event.data !== 'string') return
    const parsed = parseServerMessage(event.data)
    if (parsed !== null) dispatch(parsed)
  }

  ws.onclose = async (event: WebSocketCloseEvent): Promise<void> => {
    // `pendingRejects` is global, so this guard must come first: a superseded socket closing late
    // would otherwise reject requests already re-issued on the live one. Whoever replaced this
    // socket went through `close()`, which failed that socket's own pending requests.
    if (socket !== ws) return
    failPending('The daemon connection dropped before the reply arrived.')
    socket = null
    if (event.code === REVOKED_CLOSE_CODE) {
      wanted = false
      setStatus('idle')
      await onClosed?.('revoked')
      return
    }
    // A live disconnect gets one HTTP endpoint walk before this socket retries. The provider
    // can therefore move to LAN, Tailscale, or Funnel instead of backing off against one dead URL.
    if (everConnected) await onClosed?.('refused')
    scheduleReconnect()
  }
}

function ensureOpen(): void {
  wanted = true
  open()
}

function close(): void {
  failPending('The daemon connection closed.')
  if (retryTimer !== null) {
    clearTimeout(retryTimer)
    retryTimer = null
  }
  const stale = socket
  socket = null
  stale?.close()
  setStatus('idle')
}

export const daemonSession: DaemonSession = {
  get status(): SessionStatus {
    return status
  },
  send(message: ClientMessage): void {
    ensureOpen()
    push(message)
  },
  subscribe(listener: (message: ServerMessage) => void): () => void {
    ensureOpen()
    listeners.add(listener)
    return () => {
      listeners.delete(listener)
    }
  },
  onReconnect(handler: () => void): () => void {
    reconnectHandlers.add(handler)
    return () => {
      reconnectHandlers.delete(handler)
    }
  },
  onOpen(handler: () => void): () => void {
    ensureOpen()
    openHandlers.add(handler)
    return () => {
      openHandlers.delete(handler)
    }
  },
  watch(paths: { files?: readonly string[]; dirs?: readonly string[] }): () => void {
    const key = Symbol('watch')
    watches.set(key, { dirs: paths.dirs ?? [], files: paths.files ?? [] })
    ensureOpen()
    const current = unionWatchPaths(watches.values())
    push({ paths: current.files, t: 'watch:files' })
    push({ paths: current.dirs, t: 'watch:dirs' })
    return () => {
      watches.delete(key)
      const next = unionWatchPaths(watches.values())
      push({ paths: next.files, t: 'watch:files' })
      push({ paths: next.dirs, t: 'watch:dirs' })
    }
  },
  request<TReply extends ServerMessage>(
    message: ClientMessage,
    match: (frame: ServerMessage) => TReply | null,
    options?: { timeoutMs?: number },
  ): Promise<TReply> {
    ensureOpen()
    return new Promise<TReply>((resolve, reject) => {
      const settle = (): void => {
        clearTimeout(timer)
        pendingRejects.delete(fail)
        stop()
      }
      const fail = (error: DaemonError): void => {
        clearTimeout(timer)
        stop()
        reject(error)
      }
      const timer = setTimeout(() => {
        pendingRejects.delete(fail)
        fail(new DaemonError('unreachable', message.t, 'The daemon did not answer in time.'))
      }, options?.timeoutMs ?? REQUEST_TIMEOUT_MS)
      // The matcher dies with the socket: a reply on a fresh socket must not settle a
      // request the daemon lost when the old one closed.
      pendingRejects.add(fail)
      const stop = daemonSession.subscribe((frame) => {
        const reply = match(frame)
        if (reply === null) return
        settle()
        resolve(reply)
      })
      push(message)
    })
  },
}

/** Point the session at a daemon (or nowhere). Reconnects immediately — provider only. */
export function configureSession(next: SessionEndpoint | null): void {
  if (next === null) {
    endpoint = null
    wanted = false
    everConnected = false
    close()
    return
  }
  // Only the daemon identity forces a new socket; a repo change replays as `session:hello`
  // on the live one (see `repo.ts`), because tearing the socket down would drop the terminals.
  const changed = endpoint?.baseUrl !== next?.baseUrl || endpoint?.token !== next?.token
  endpoint = next
  if (!changed) return
  everConnected = false
  retryDelay = MIN_RETRY_MS
  close()
  // Subscribers registered against the previous socket still want frames from the new one.
  if (listeners.size > 0 || watches.size > 0) ensureOpen()
}

/** Sockets die in the background and reopen on `active` — an idle phone holds no connection. */
export function setSessionForeground(active: boolean): void {
  foreground = active
  if (active) open()
  else close()
}

/** How the provider learns a socket died for a credential reason rather than a network one. */
export function onSessionClosed(
  handler: (reason: SessionCloseReason) => Promise<void> | void,
): void {
  onClosed = handler
}

export function useDaemonSession(): DaemonSession {
  const current = useSyncExternalStore(
    (listener: () => void) => {
      statusListeners.add(listener)
      return () => {
        statusListeners.delete(listener)
      }
    },
    () => status,
    () => status,
  )
  return useMemo(() => ({ ...daemonSession, status: current }), [current])
}
