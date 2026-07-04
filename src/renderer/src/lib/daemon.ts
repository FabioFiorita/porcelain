import {
  type AppEvent,
  type ClientMessage,
  type ServerMessage,
  serverMessageSchema,
} from '@shared/ws-protocol'

/**
 * The renderer's connection to the daemon: the base url for the appRouter's HTTP
 * transport (lib/trpc.ts) and the ONE WebSocket session (`/session`) carrying
 * everything that isn't request/response — app-event pushes in, terminal bytes
 * both ways, watch registrations out (see `@shared/ws-protocol`).
 *
 * Lives in lib (module singleton, like the terminal registry) and is consumed
 * ONLY by the existing hook files (`use-app-events`, `use-terminal-channel`,
 * `use-files`) and the terminal registry/store — components never import it,
 * same layering as lib/trpc.
 *
 * Reconnect story: the socket retries with capped backoff for as long as the
 * daemon is down; the shell pushes a NEW url over `daemon.onUrlChanged` when it
 * restarts a crashed daemon on a fresh port. On every reconnect the client
 * re-registers the last watch sets (server-side session state died with the old
 * socket) and notifies `onDaemonReconnect` subscribers (use-app-events refetches
 * queries). Terminal routing needs no re-attach — inbound messages are dispatched
 * by id to the same listeners regardless of which socket delivered them.
 */

// window.porcelain is absent under vitest/jsdom — fall back quietly; nothing
// connects in unit tests (hooks are mocked; ensureSession is lazy).
let baseUrl = window.porcelain?.daemon?.url ?? ''
let token = window.porcelain?.daemon?.token ?? ''

/** The daemon's HTTP origin. Falls back to the page origin — Phase 3 serves the remote client FROM the daemon, making it same-origin. */
export function daemonBaseUrl(): string {
  return baseUrl !== '' ? baseUrl : window.location.origin
}

/** The session token every daemon request must carry ('' only on the Phase-3 browser path, which defines its own auth). */
export function daemonToken(): string {
  return token
}

const eventListeners = new Set<(event: AppEvent) => void>()
const dataListeners = new Set<(id: string, data: string) => void>()
const exitListeners = new Set<(id: string, exitCode: number) => void>()
const reconnectListeners = new Set<() => void>()
interface PendingCreate {
  resolve: (id: string) => void
  reject: (error: Error) => void
}
const pendingCreates = new Map<string, PendingCreate>()
// Creates issued while the socket is still CONNECTING are queued and flushed on
// open; fire-and-forget messages (write/resize/kill/watch) are not — a dead
// socket means dead PTYs, and watches re-register from lastWatched* on open.
// Both the queue and the in-flight creates die with the socket (see onclose):
// replaying a stale terminal:create on a much-later reconnect would spawn a
// shell nobody is waiting for.
const outbox: ClientMessage[] = []
let lastWatchedFiles: string[] | null = null
let lastWatchedDirs: string[] | null = null

let socket: WebSocket | null = null
let everConnected = false
// Set when the shell pushes a fresh daemon url (the daemon came up late or was
// restarted): the NEXT successful connect must refetch queries even if this is
// the first-ever connect — boot queries errored against the dead/absent daemon.
let recoveryPending = false
let retryDelay = 500
let reconnectTimer: number | null = null

/** Fail every in-flight/queued terminal create — their socket is gone. */
function failPendingCreates(reason: string): void {
  outbox.length = 0
  const pending = [...pendingCreates.values()]
  pendingCreates.clear()
  for (const { reject } of pending) reject(new Error(reason))
}

function dispatch(message: ServerMessage): void {
  switch (message.t) {
    case 'app-event':
      for (const listener of eventListeners) listener(message.event)
      break
    case 'terminal:data':
      for (const listener of dataListeners) listener(message.id, message.data)
      break
    case 'terminal:exit':
      for (const listener of exitListeners) listener(message.id, message.exitCode)
      break
    case 'terminal:created': {
      const pending = pendingCreates.get(message.reqId)
      if (pending) {
        pendingCreates.delete(message.reqId)
        pending.resolve(message.id)
      }
      break
    }
  }
}

function push(message: ClientMessage): void {
  if (socket !== null && socket.readyState === WebSocket.OPEN) {
    socket.send(JSON.stringify(message))
  }
}

function scheduleReconnect(): void {
  if (reconnectTimer !== null) return
  reconnectTimer = window.setTimeout(() => {
    reconnectTimer = null
    ensureSession()
  }, retryDelay)
  retryDelay = Math.min(retryDelay * 2, 10_000)
}

/** Idempotent: opens the session if it isn't open/connecting. Called lazily by every consumer. */
function ensureSession(): void {
  if (
    socket !== null &&
    (socket.readyState === WebSocket.OPEN || socket.readyState === WebSocket.CONNECTING)
  ) {
    return
  }
  // The token rides as the requested subprotocol (`porcelain.<token>`) — the
  // one header a browser WebSocket can carry — because the upgrade has no CORS
  // check at all; the daemon rejects the handshake without it (server.ts).
  const ws = new WebSocket(
    `${daemonBaseUrl().replace(/^http/, 'ws')}/session`,
    token !== '' ? [`porcelain.${token}`] : [],
  )
  socket = ws
  ws.onopen = () => {
    if (socket !== ws) return
    retryDelay = 500
    // The daemon keys watchers by session, so a fresh socket starts blank —
    // replay the current watch sets before anything else.
    if (lastWatchedFiles !== null) push({ t: 'watch:files', paths: lastWatchedFiles })
    if (lastWatchedDirs !== null) push({ t: 'watch:dirs', paths: lastWatchedDirs })
    for (const message of outbox.splice(0)) push(message)
    // Refetch on every REconnect — and on the first connect after the shell
    // pushed a fresh url (the daemon came up late; boot queries errored and
    // must recover now, not on the next manual refetch).
    if (everConnected || recoveryPending) for (const listener of reconnectListeners) listener()
    recoveryPending = false
    everConnected = true
  }
  ws.onmessage = (event) => {
    if (typeof event.data !== 'string') return
    let json: unknown
    try {
      json = JSON.parse(event.data)
    } catch {
      return
    }
    // Validate on the way in, mirroring the daemon — protocol drift fails
    // quietly per message instead of mis-shaping data downstream.
    const parsed = serverMessageSchema.safeParse(json)
    if (parsed.success) dispatch(parsed.data)
  }
  ws.onclose = () => {
    // Creates addressed to THIS socket can never be answered — fail them even
    // if a newer socket has already taken over (their reqIds died with ws).
    failPendingCreates(
      'The Porcelain daemon connection dropped before the terminal could be created. Try again in a moment — the app reconnects automatically.',
    )
    if (socket !== ws) return
    socket = null
    scheduleReconnect()
  }
}

// A daemon restart lands on a new port: adopt the url (+ token — stable per app
// run, re-sent for one payload shape), drop the socket aimed at the dead
// process, and reconnect immediately (skipping any pending backoff).
window.porcelain?.daemon?.onUrlChanged((info) => {
  baseUrl = info.url
  token = info.token
  recoveryPending = true
  if (reconnectTimer !== null) {
    window.clearTimeout(reconnectTimer)
    reconnectTimer = null
  }
  retryDelay = 500
  const stale = socket
  socket = null
  stale?.close()
  ensureSession()
})

export function onDaemonEvent(listener: (event: AppEvent) => void): () => void {
  ensureSession()
  eventListeners.add(listener)
  return () => eventListeners.delete(listener)
}

export function onTerminalData(listener: (id: string, data: string) => void): () => void {
  ensureSession()
  dataListeners.add(listener)
  return () => dataListeners.delete(listener)
}

export function onTerminalExit(listener: (id: string, exitCode: number) => void): () => void {
  ensureSession()
  exitListeners.add(listener)
  return () => exitListeners.delete(listener)
}

/** Fires after the session comes BACK (never on the first connect) — queries are stale, refetch. */
export function onDaemonReconnect(listener: () => void): () => void {
  ensureSession()
  reconnectListeners.add(listener)
  return () => reconnectListeners.delete(listener)
}

/** Register the open-file set to watch; replayed automatically on reconnect. */
export function watchFiles(paths: string[]): void {
  lastWatchedFiles = paths
  ensureSession()
  push({ t: 'watch:files', paths })
}

/** Register the expanded-dir set to watch; replayed automatically on reconnect. */
export function watchDirs(paths: string[]): void {
  lastWatchedDirs = paths
  ensureSession()
  push({ t: 'watch:dirs', paths })
}

/**
 * Spawn a PTY; resolves with its id via the reqId-correlated `terminal:created`
 * reply. Rejects if the session drops before the daemon answers (the socket's
 * close fails all in-flight creates) — callers surface the error instead of
 * hanging on a promise that can never settle.
 */
export function createTerminal(opts: {
  cwd: string
  initialInput?: string
  cols?: number
  rows?: number
}): Promise<string> {
  ensureSession()
  return new Promise<string>((resolve, reject) => {
    const reqId = crypto.randomUUID()
    pendingCreates.set(reqId, { resolve, reject })
    const message: ClientMessage = { t: 'terminal:create', reqId, ...opts }
    if (socket !== null && socket.readyState === WebSocket.OPEN) push(message)
    else outbox.push(message)
  })
}

export function writeTerminal(id: string, data: string): void {
  push({ t: 'terminal:write', id, data })
}

export function resizeTerminal(id: string, cols: number, rows: number): void {
  push({ t: 'terminal:resize', id, cols, rows })
}

export function killTerminal(id: string): void {
  push({ t: 'terminal:kill', id })
}
