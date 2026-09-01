import {
  nextRemoteRetry,
  resetRemoteRetry,
  type SessionHealth,
} from '@porcelain/client-runtime/remote'
import type { SessionClientRuntime } from '@porcelain/client-runtime/session/client-runtime'
import {
  sessionSubprotocol,
  sessionWebSocketUrl,
} from '@porcelain/client-runtime/session/transport'

/**
 * The browser half of the shared session runtime: one WebSocket, its auth, and the reconnect
 * timer around `@porcelain/client-runtime/session/client-runtime`.
 *
 * The split is the point. Everything the *protocol* does — hello/ready, watches after ready,
 * per-connection sequence recovery, terminal frame delivery, the terminal mismatch state — lives
 * in the shared runtime and is identical on Web and mobile. What is left here is the
 * part a browser owns and mobile cannot share: opening a `WebSocket`, carrying the token the one
 * way a browser can carry it, resolving the daemon origin, and deciding when to try again. This
 * adapter never parses a frame, never invents a state, and never reimplements a recovery rule.
 *
 * ```text
 * endpoint → WebSocket → adapter → runtime.connected / receive / disconnected
 *                          ↑                    ↓
 *                    backoff timer      observer (createDaemonSession)
 * ```
 *
 * Owned by `createDaemonSession` (`lib/daemon.ts`): one adapter per daemon connection,
 * shared by terminal traffic and `useSessionRuntime` invalidation. Do not construct a
 * second adapter for the same window.
 */

/** Where a session points. An empty `url` means the page origin — the daemon serves this client. */
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
  readonly closed: () => void
}

/**
 * How a socket comes into being. Injectable so the whole lifecycle is table-testable without a
 * port; the default is the real browser `WebSocket`.
 */
export type SessionSocketOpener = (input: {
  readonly url: string
  readonly protocols: readonly string[]
  readonly handlers: SessionSocketHandlers
}) => SessionSocket

/** A cancellable delayed run. Injectable for the same reason as the opener. */
export type SessionRetrySchedule = (run: () => void, delayMs: number) => () => void

/**
 * What a human can be told about this connection. `connecting` and `reconnecting` are the same
 * mechanism reported differently, because "still trying" and "trying again" mean different
 * things on screen. `update-required` is terminal: the daemon has refused this build's protocol
 * and no amount of reconnecting changes its answer.
 */
export type SessionConnectionState = 'idle' | 'connecting' | 'open' | 'reconnecting'

/** The recoverable connection state, plus the one unrecoverable outcome. */
export type SessionConnectionStatus = SessionConnectionState | 'update-required'

export type SessionBrowserAdapter = {
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
  socket.onmessage = (event: MessageEvent): void => {
    // A binary frame is not something this protocol defines; drop it rather than coerce it.
    if (typeof event.data === 'string') handlers.message(event.data)
  }
  socket.onclose = (): void => handlers.closed()
  // An error is always followed by a close on a browser WebSocket, so `closed` alone drives
  // recovery — reacting to both would double-schedule the same reconnect.
  return {
    send: (payload: string): void => socket.send(payload),
    close: (): void => socket.close(),
  }
}

const defaultSchedule: SessionRetrySchedule = (run, delayMs) => {
  const timer = window.setTimeout(run, delayMs)
  return (): void => window.clearTimeout(timer)
}

export function createSessionBrowserAdapter({
  runtime,
  endpoint,
  openSocket = defaultOpenSocket,
  schedule = defaultSchedule,
  pageOrigin = (): string => window.location.origin,
  onStatusChange,
  random = Math.random,
  health,
}: {
  readonly runtime: SessionClientRuntime
  readonly endpoint: () => SessionEndpoint
  readonly openSocket?: SessionSocketOpener
  readonly schedule?: SessionRetrySchedule
  readonly pageOrigin?: () => string
  readonly onStatusChange?: (status: SessionConnectionStatus) => void
  readonly random?: () => number
  readonly health?: SessionHealth
}): SessionBrowserAdapter {
  let socket: SessionSocket | undefined
  let cancelRetry: (() => void) | undefined
  let retryDelay = resetRemoteRetry()
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
    // browser WebSocket can carry, and the upgrade has no CORS check at all.
    const opened = openSocket({
      url: sessionWebSocketUrl(url !== '' ? url : pageOrigin()),
      protocols: token !== '' ? [sessionSubprotocol(token)] : [],
      handlers: {
        opened: () => {
          // Identity check on every handler: a socket the adapter has already replaced or
          // retired must not be able to drive the runtime it no longer belongs to.
          if (socket !== opened) return
          retryDelay = resetRemoteRetry()
          everConnected = true
          health?.apply({ type: 'connected' })
          setStatus('open')
          runtime.connected({ send: (payload: string) => opened.send(payload) })
        },
        message: (raw) => {
          if (socket !== opened) return
          runtime.receive(raw)
        },
        closed: () => {
          if (socket !== opened) return
          socket = undefined
          runtime.disconnected()
          if (!running) return
          health?.apply({ type: 'disconnected' })
          setStatus(everConnected ? 'reconnecting' : 'connecting')
          scheduleReconnect()
        },
      },
    })
    socket = opened
    setStatus(everConnected ? 'reconnecting' : 'connecting')
  }

  function scheduleReconnect(): void {
    if (cancelRetry !== undefined) return
    const step = nextRemoteRetry(retryDelay, random)
    cancelRetry = schedule(() => {
      cancelRetry = undefined
      if (!running) return
      connect()
    }, step.waitMs)
    retryDelay = step.delayMs
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
      health?.apply({ type: 'start' })
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
      health?.apply({ type: 'stop' })
      setStatus('idle')
    },

    updateRequired() {
      running = false
      retire()
      health?.apply({ type: 'update-required' })
      setStatus('update-required')
    },

    status() {
      return status
    },
  }
}
