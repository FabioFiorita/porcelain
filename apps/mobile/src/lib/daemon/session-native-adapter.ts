import type { SessionClientRuntime } from '@porcelain/client-runtime/session/client-runtime'
import {
  MIN_RETRY_MS,
  nextRetryDelay,
  reconnectDelayMs,
  sessionSubprotocol,
  sessionWebSocketUrl,
} from '@porcelain/client-runtime/session/transport'

/**
 * The React Native half of the shared session runtime: one WebSocket, its auth, and the
 * reconnect timer around `@porcelain/client-runtime/session/client-runtime`.
 *
 * Parallel to the browser adapter (`apps/web/src/lib/session-browser-adapter.ts`). Everything
 * the *protocol* does — hello/ready, watches after ready, sequence recovery, terminal frames,
 * the terminal mismatch state — lives in the shared runtime (`RT-003`). What is left here is
 * the part React Native owns: opening a `WebSocket`, carrying the token as a subprotocol,
 * resolving the daemon origin from the paired environment, and deciding when to try again.
 * This adapter never parses a frame, never invents a state, and never reimplements a recovery
 * rule.
 *
 * ```text
 * endpoint → WebSocket → adapter → runtime.connected / receive / disconnected
 *                          ↑                    ↓
 *                    backoff timer      observer (session.ts / provider)
 * ```
 */

/** Where a session points. `url` is the paired daemon origin (http/https). */
export type SessionEndpoint = {
  readonly url: string
  readonly token: string
}

/** The only two things this adapter asks of a live socket. */
export type SessionSocket = {
  readonly send: (payload: string) => void
  readonly close: () => void
}

/** What the adapter needs told about a socket it opened. */
export type SessionSocketHandlers = {
  readonly opened: () => void
  readonly message: (raw: string) => void
  readonly closed: (code: number) => void
}

/**
 * How a socket comes into being. Injectable so the whole lifecycle is table-testable without a
 * native runtime; the default is the global React Native `WebSocket`.
 */
export type SessionSocketOpener = (input: {
  readonly url: string
  readonly protocols: readonly string[]
  readonly handlers: SessionSocketHandlers
}) => SessionSocket

/** A cancellable delayed run. Injectable for the same reason as the opener. */
export type SessionRetrySchedule = (run: () => void, delayMs: number) => () => void

/**
 * Cap on the backoff between reconnect attempts. Matches the browser client's 10s rather than
 * the shared 8s default: a phone left on overnight against a stopped daemon should not poll it
 * four hundred times an hour.
 */
const MAX_RETRY_MS = 10_000

/**
 * What a human can be told about this connection. `connecting` and `reconnecting` are the same
 * mechanism reported differently. `update-required` is terminal: the daemon has refused this
 * build's protocol and no amount of reconnecting changes its answer.
 */
export type SessionConnectionState = 'idle' | 'connecting' | 'open' | 'reconnecting'

/** The recoverable connection state, plus the one unrecoverable outcome. */
export type SessionConnectionStatus = SessionConnectionState | 'update-required'

export type SessionNativeAdapter = {
  /** Open the session and keep it open, reconnecting with capped backoff. Idempotent. */
  readonly start: () => void
  /** Close the session and stop reconnecting. Idempotent. */
  readonly stop: () => void
  /**
   * The daemon refused this build's protocol. Called by the observer that received the runtime's
   * `onUpdateRequired`; retiring the transport is the adapter's job because the runtime owns no
   * socket and no timer.
   */
  readonly updateRequired: () => void
  readonly status: () => SessionConnectionStatus
}

function defaultOpenSocket({
  url,
  protocols,
  handlers,
}: {
  url: string
  protocols: readonly string[]
  handlers: SessionSocketHandlers
}): SessionSocket {
  const socket = new WebSocket(url, [...protocols])
  socket.onopen = (): void => handlers.opened()
  socket.onmessage = (event: WebSocketMessageEvent): void => {
    // A binary frame is not something this protocol defines; drop it rather than coerce it.
    if (typeof event.data === 'string') handlers.message(event.data)
  }
  socket.onclose = (event: WebSocketCloseEvent): void => {
    // RN types allow `code` to be missing on abnormal drops; treat that as a generic 1006.
    handlers.closed(event.code ?? 1006)
  }
  // An error is always followed by a close on a React Native WebSocket, so `closed` alone drives
  // recovery — reacting to both would double-schedule the same reconnect.
  return {
    send: (payload: string): void => socket.send(payload),
    close: (): void => socket.close(),
  }
}

const defaultSchedule: SessionRetrySchedule = (run, delayMs) => {
  const timer = setTimeout(run, delayMs)
  return (): void => clearTimeout(timer)
}

export function createSessionNativeAdapter({
  runtime,
  endpoint,
  openSocket = defaultOpenSocket,
  schedule = defaultSchedule,
  onStatusChange,
  /**
   * Decides whether a closed socket should schedule a reconnect. Return `false` to leave the
   * adapter stopped (e.g. daemon close code 4001 — token revoked). Default always reconnects
   * while `start`ed.
   */
  shouldReconnect = (): boolean => true,
  /** Fires after the runtime is told about a drop, before reconnect is scheduled. */
  onTransportClosed,
}: {
  readonly runtime: SessionClientRuntime
  readonly endpoint: () => SessionEndpoint
  readonly openSocket?: SessionSocketOpener
  readonly schedule?: SessionRetrySchedule
  readonly onStatusChange?: (status: SessionConnectionStatus) => void
  readonly shouldReconnect?: (closeCode: number) => boolean
  readonly onTransportClosed?: (closeCode: number) => void | Promise<void>
}): SessionNativeAdapter {
  let socket: SessionSocket | undefined
  let cancelRetry: (() => void) | undefined
  let retryDelay = MIN_RETRY_MS
  let running = false
  let everConnected = false
  let status: SessionConnectionStatus = 'idle'

  const setStatus = (next: SessionConnectionStatus): void => {
    if (status === next) return
    status = next
    onStatusChange?.(next)
  }

  const clearRetry = (): void => {
    cancelRetry?.()
    cancelRetry = undefined
  }

  const connect = (): void => {
    const { url, token } = endpoint()
    // The token rides as the requested subprotocol (`porcelain.<token>`) — the one header a
    // WebSocket can carry, and the reason it never lands in a query string a proxy would log.
    const opened = openSocket({
      url: sessionWebSocketUrl(url),
      protocols: token !== '' ? [sessionSubprotocol(token)] : [],
      handlers: {
        opened: () => {
          // Identity check on every handler: a socket the adapter has already replaced or
          // retired must not be able to drive the runtime it no longer belongs to.
          if (socket !== opened) return
          retryDelay = MIN_RETRY_MS
          everConnected = true
          setStatus('open')
          runtime.connected({ send: (payload: string) => opened.send(payload) })
        },
        message: (raw) => {
          if (socket !== opened) return
          runtime.receive(raw)
        },
        closed: (code) => {
          if (socket !== opened) return
          socket = undefined
          runtime.disconnected()
          if (!running) return
          const reconnect = shouldReconnect(code)
          if (!reconnect) {
            running = false
            setStatus('idle')
            void onTransportClosed?.(code)
            return
          }
          setStatus('reconnecting')
          const maybe = onTransportClosed?.(code)
          if (maybe !== undefined && typeof (maybe as Promise<void>).then === 'function') {
            void (maybe as Promise<void>).then(() => {
              if (running) scheduleReconnect()
            })
            return
          }
          scheduleReconnect()
        },
      },
    })
    socket = opened
    setStatus(everConnected ? 'reconnecting' : 'connecting')
  }

  function scheduleReconnect(): void {
    if (cancelRetry !== undefined) return
    // Jittered so a daemon restart does not bring every client back in the same millisecond.
    cancelRetry = schedule(() => {
      cancelRetry = undefined
      if (!running) return
      connect()
    }, reconnectDelayMs(retryDelay))
    retryDelay = nextRetryDelay(retryDelay, MAX_RETRY_MS)
  }

  const retire = (): void => {
    clearRetry()
    const stale = socket
    socket = undefined
    stale?.close()
  }

  return {
    start() {
      if (running) return
      running = true
      connect()
    },

    stop() {
      if (!running) return
      running = false
      const wasConnected = socket !== undefined
      retire()
      // The runtime is told directly rather than through the closed handler: `retire` already
      // disowned the socket, so its close event is correctly ignored.
      if (wasConnected) runtime.disconnected()
      setStatus('idle')
    },

    updateRequired() {
      running = false
      retire()
      setStatus('update-required')
    },

    status() {
      return status
    },
  }
}
