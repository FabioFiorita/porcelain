import type {
  AgentEvent,
  AgentImage,
  AgentStatus,
  ApprovalDecision,
  TimelineItem,
} from '@shared/agent-protocol'
import {
  type AppEvent,
  type ClientMessage,
  type ServerMessage,
  serverMessageSchema,
} from '@shared/ws-protocol'
import { randomId } from './utils'

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
 * re-registers the last watch sets AND re-attaches every terminal it was streaming
 * (server-side session state died with the old socket — the daemon keys attached
 * senders by connection). The fresh scrollback from each re-attach is pushed through
 * the `onTerminalScrollback` listeners so the registry can replay it into the xterm;
 * inbound `terminal:data` is otherwise dispatched by id to the same listeners
 * regardless of which socket delivered it. `onDaemonReconnect` subscribers are also
 * notified (use-app-events refetches queries).
 */

// The localStorage key the browser client stores its user-entered daemon token
// under (Phase 3): the packaged app gets its token from the preload bridge, but a
// plain browser has no bridge, so the human types it once on the TokenGate screen
// and it's persisted here.
const BROWSER_TOKEN_KEY = 'porcelain-daemon-token'

// The bridge is absent both in the browser client AND under vitest/jsdom. In the
// browser we read the persisted token from localStorage; under jsdom localStorage
// exists and returns null → '' (nothing connects in unit tests — hooks are mocked,
// ensureSession is lazy), so this fallback stays quiet there too.
function initialToken(): string {
  const fromBridge = window.porcelain?.daemon?.token
  if (fromBridge !== undefined) return fromBridge
  return localStorage.getItem(BROWSER_TOKEN_KEY) ?? ''
}

// window.porcelain is absent under vitest/jsdom — fall back quietly; nothing
// connects in unit tests (hooks are mocked; ensureSession is lazy).
let baseUrl = window.porcelain?.daemon?.url ?? ''
let token = initialToken()

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
const scrollbackListeners = new Set<(id: string, scrollback: string) => void>()
const reconnectListeners = new Set<() => void>()
interface PendingCreate {
  resolve: (id: string) => void
  reject: (error: Error) => void
}
const pendingCreates = new Map<string, PendingCreate>()
export interface AttachResult {
  scrollback: string
  status: 'running' | 'exited'
  exitCode?: number
  found: boolean
}
interface PendingAttach {
  resolve: (result: AttachResult) => void
  reject: (error: Error) => void
}
const pendingAttaches = new Map<string, PendingAttach>()
// The ids this client is currently streaming — re-sent as `terminal:attach` on every
// reconnect (the daemon's attached-sender set died with the old socket), with the fresh
// scrollback routed through the scrollback listeners so the registry can replay it.
const attachedIds = new Set<string>()

// The Agent-thread twins of the terminal streaming plumbing above. A thread is a
// daemon-owned session like a PTY: attach replays a reduced timeline snapshot then live
// `agent:event`s follow, socket close detaches (never kills), and a reconnect re-attaches
// every id in `attachedThreadIds` (the daemon's attached-sender set died with the old
// socket). Events fan out to `agentEventListeners`; each attach snapshot (initial AND
// reconnect) fans out to `agentSnapshotListeners` so the store re-seeds regardless of
// which socket delivered it — mirroring `onTerminalScrollback`.
const agentEventListeners = new Set<(threadId: string, event: AgentEvent) => void>()
const agentSnapshotListeners = new Set<
  (threadId: string, items: TimelineItem[], status: AgentStatus) => void
>()
export interface AgentAttachResult {
  found: boolean
  items: TimelineItem[]
  status: AgentStatus
}
interface PendingAgentAttach {
  resolve: (result: AgentAttachResult) => void
  reject: (error: Error) => void
}
const pendingAgentAttaches = new Map<string, PendingAgentAttach>()
const attachedThreadIds = new Set<string>()
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

/** Fail every in-flight/queued create + attach (terminal AND agent) — their socket is gone. */
function failPendingCreates(reason: string): void {
  outbox.length = 0
  const creates = [...pendingCreates.values()]
  pendingCreates.clear()
  for (const { reject } of creates) reject(new Error(reason))
  const attaches = [...pendingAttaches.values()]
  pendingAttaches.clear()
  for (const { reject } of attaches) reject(new Error(reason))
  const agentAttaches = [...pendingAgentAttaches.values()]
  pendingAgentAttaches.clear()
  for (const { reject } of agentAttaches) reject(new Error(reason))
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
    case 'terminal:attached': {
      // Route the replay scrollback to the registry before any live data follows
      // (the daemon sends this reply before subsequent terminal:data), then settle
      // the pending attach promise for the caller that awaited the initial attach.
      for (const listener of scrollbackListeners) listener(message.id, message.scrollback)
      const pending = pendingAttaches.get(message.reqId)
      if (pending) {
        pendingAttaches.delete(message.reqId)
        pending.resolve({
          scrollback: message.scrollback,
          status: message.status,
          exitCode: message.exitCode,
          found: message.found,
        })
      }
      break
    }
    case 'agent:event':
      for (const listener of agentEventListeners) listener(message.threadId, message.event)
      break
    case 'agent:attached': {
      // Seed the store with the reduced snapshot before any live event follows (the
      // daemon sends this reply before subsequent agent:event), then settle the pending
      // attach promise for the caller that awaited the initial attach.
      for (const listener of agentSnapshotListeners)
        listener(message.threadId, message.items, message.status)
      const pending = pendingAgentAttaches.get(message.reqId)
      if (pending) {
        pendingAgentAttaches.delete(message.reqId)
        pending.resolve({ found: message.found, items: message.items, status: message.status })
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

/**
 * Send now if the socket is OPEN, else queue in the outbox to flush on the next open —
 * the same pattern `createTerminal`/`attachTerminal` use. For agent turn actions
 * (`agent:send`/`approve`/`abort`) a bare `push` would SILENTLY DROP while the socket is
 * reconnecting, yet the composer clears its draft the instant it calls send — so the
 * message would be lost with no trace. Queuing flushes it once the session comes back.
 * Safe to replay (unlike a stale `terminal:create`, which spawns an abandoned shell):
 * the thread is daemon-owned and outlives the socket, so a queued send/approve/abort
 * still targets a live thread on reconnect. Like every queued message it's cleared if the
 * socket closes before the flush (failPendingCreates) — a never-reconnecting drop can't be
 * helped, but a reconnect gap no longer eats the message.
 */
function sendOrQueue(message: ClientMessage): void {
  ensureSession()
  if (socket !== null && socket.readyState === WebSocket.OPEN) push(message)
  else outbox.push(message)
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
    // On a genuine REconnect, re-attach every terminal this client was streaming: the
    // daemon's attached-sender set died with the old socket, so a fresh attach
    // re-registers us and its scrollback reply replays into the registry (dispatch →
    // scrollbackListeners). Not awaited — best-effort re-registrations, not the initial
    // attach promise. Skipped on the first-ever open: those attaches are already queued
    // in the outbox (double-sending would replay scrollback twice).
    if (everConnected) {
      for (const id of attachedIds) push({ t: 'terminal:attach', id, reqId: randomId() })
      // Same for Agent threads: re-attach re-registers this socket and its snapshot
      // reply re-seeds the store (dispatch → agentSnapshotListeners). Best-effort, not
      // awaited — the reqId has no waiting promise here.
      for (const threadId of attachedThreadIds)
        push({ t: 'agent:attach', threadId, reqId: randomId() })
    }
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

// Drop the current socket and reconnect immediately with the current baseUrl/token,
// skipping any pending backoff. Shared by the shell's url-change push (below) and
// the browser's token-gate submit (setBrowserDaemonToken) — both change what the
// next handshake must carry, so both want the same forced-reconnect path.
function reconnectNow(): void {
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
}

// A daemon restart lands on a new port: adopt the url (+ token — stable per app
// run, re-sent for one payload shape), drop the socket aimed at the dead
// process, and reconnect immediately (skipping any pending backoff).
window.porcelain?.daemon?.onUrlChanged((info) => {
  baseUrl = info.url
  token = info.token
  reconnectNow()
})

/**
 * Persist and adopt a browser-client daemon token (from the TokenGate screen),
 * then reconnect the WS with the new subprotocol — no reload needed. The base
 * url stays the page origin (daemonBaseUrl's fallback); only the token changes.
 * A no-op for the packaged app, which never calls this (its token rides the bridge).
 */
export function setBrowserDaemonToken(newToken: string): void {
  localStorage.setItem(BROWSER_TOKEN_KEY, newToken)
  token = newToken
  reconnectNow()
}

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

/**
 * Fires with a session's replay scrollback on attach (both the initial attach and every
 * reconnect re-attach). The registry replays it into the xterm before live data follows.
 */
export function onTerminalScrollback(
  listener: (id: string, scrollback: string) => void,
): () => void {
  ensureSession()
  scrollbackListeners.add(listener)
  return () => scrollbackListeners.delete(listener)
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
  name: string
  cwd: string
  initialInput?: string
  cols?: number
  rows?: number
}): Promise<string> {
  ensureSession()
  return new Promise<string>((resolve, reject) => {
    const reqId = randomId()
    pendingCreates.set(reqId, {
      // The creator is auto-attached daemon-side — track the id so a later reconnect
      // re-attaches it like any other streaming terminal.
      resolve: (id) => {
        attachedIds.add(id)
        resolve(id)
      },
      reject,
    })
    const message: ClientMessage = { t: 'terminal:create', reqId, ...opts }
    if (socket !== null && socket.readyState === WebSocket.OPEN) push(message)
    else outbox.push(message)
  })
}

/**
 * Attach to a daemon-owned PTY (opening a session hydrated from the roster after a
 * reload, or a second view of one already running) and resolve with its replay
 * scrollback + state. The scrollback is ALSO pushed through `onTerminalScrollback` (the
 * registry's replay path); the promise result is for the caller that needs the state
 * (e.g. an already-exited session). Rejects if the socket drops before the daemon
 * answers, like create. Re-attaches automatically on every reconnect thereafter.
 */
export function attachTerminal(id: string): Promise<AttachResult> {
  ensureSession()
  attachedIds.add(id)
  return new Promise<AttachResult>((resolve, reject) => {
    const reqId = randomId()
    pendingAttaches.set(reqId, {
      resolve,
      // A socket drop before the reply rejects this — drop the id so `isTerminalAttached`
      // reports false and the next roster hydrate re-attaches (the reconnect re-attach
      // loop only fires once everConnected, so an initial-connect failure needs this).
      reject: (error) => {
        attachedIds.delete(id)
        reject(error)
      },
    })
    const message: ClientMessage = { t: 'terminal:attach', id, reqId }
    if (socket !== null && socket.readyState === WebSocket.OPEN) push(message)
    else outbox.push(message)
  })
}

/** Stop streaming a PTY to this client without killing it (fire-and-forget). */
export function detachTerminal(id: string): void {
  attachedIds.delete(id)
  push({ t: 'terminal:detach', id })
}

/** Whether this client is currently streaming `id` — so a caller doesn't re-attach it. */
export function isTerminalAttached(id: string): boolean {
  return attachedIds.has(id)
}

export function writeTerminal(id: string, data: string): void {
  push({ t: 'terminal:write', id, data })
}

export function resizeTerminal(id: string, cols: number, rows: number): void {
  push({ t: 'terminal:resize', id, cols, rows })
}

export function killTerminal(id: string): void {
  attachedIds.delete(id)
  push({ t: 'terminal:kill', id })
}

/** Fires with each thread's live turn events; the channel hook reduces them into the store. */
export function onAgentEvent(listener: (threadId: string, event: AgentEvent) => void): () => void {
  ensureSession()
  agentEventListeners.add(listener)
  return () => agentEventListeners.delete(listener)
}

/**
 * Fires with a thread's reduced timeline snapshot on attach (both the initial attach and
 * every reconnect re-attach). The channel hook seeds the store with it before live events
 * follow — the single application path (like `onTerminalScrollback`), so a live event that
 * lands between attach and the awaited promise can't be clobbered by a late re-apply.
 */
export function onAgentSnapshot(
  listener: (threadId: string, items: TimelineItem[], status: AgentStatus) => void,
): () => void {
  ensureSession()
  agentSnapshotListeners.add(listener)
  return () => agentSnapshotListeners.delete(listener)
}

/**
 * Attach to a daemon-owned Agent thread and resolve with its reduced timeline snapshot +
 * status. The snapshot is ALSO pushed through `onAgentSnapshot` (the store's seed path);
 * the promise result is for the caller that needs the state. Rejects if the socket drops
 * before the daemon answers, like `attachTerminal`. Re-attaches on every reconnect after.
 */
export function attachAgent(threadId: string): Promise<AgentAttachResult> {
  ensureSession()
  attachedThreadIds.add(threadId)
  return new Promise<AgentAttachResult>((resolve, reject) => {
    const reqId = randomId()
    pendingAgentAttaches.set(reqId, {
      resolve,
      // A socket drop before the reply rejects this — drop the id so `isAgentAttached`
      // reports false and a re-open re-attaches (the reconnect loop only fires once
      // everConnected, so an initial-connect failure needs this).
      reject: (error) => {
        attachedThreadIds.delete(threadId)
        reject(error)
      },
    })
    const message: ClientMessage = { t: 'agent:attach', threadId, reqId }
    if (socket !== null && socket.readyState === WebSocket.OPEN) push(message)
    else outbox.push(message)
  })
}

/** Stop streaming a thread's events to this client without ending the thread (fire-and-forget). */
export function detachAgent(threadId: string): void {
  attachedThreadIds.delete(threadId)
  push({ t: 'agent:detach', threadId })
}

/** Whether this client is currently streaming `threadId` — so a caller doesn't re-attach it. */
export function isAgentAttached(threadId: string): boolean {
  return attachedThreadIds.has(threadId)
}

/**
 * Send a message to a thread — starts a turn if idle, or appends it to the FIFO queue
 * behind a running turn daemon-side. Queued through the outbox so a send during a reconnect
 * gap flushes on open instead of being silently dropped (the composer clears its draft
 * immediately — see `sendOrQueue`). `thumbnails` are the downscaled previews the timeline
 * persists; `images` are the full payloads the CLI receives.
 */
export function sendAgentMessage(
  threadId: string,
  message: { text: string; images?: AgentImage[]; thumbnails?: AgentImage[] },
): void {
  sendOrQueue({
    t: 'agent:send',
    threadId,
    text: message.text,
    images: message.images,
    thumbnails: message.thumbnails,
  })
}

/** Interrupt the thread's active turn; queued to flush on reconnect (see `sendOrQueue`). */
export function abortAgentTurn(threadId: string): void {
  sendOrQueue({ t: 'agent:abort', threadId })
}

/**
 * Cancel a queued message (or the whole queue when `index` is omitted). Rides the outbox
 * so a cancel during reconnect flushes on open (see `sendOrQueue`).
 */
export function cancelQueuedAgentMessage(threadId: string, index?: number): void {
  sendOrQueue({
    t: 'agent:cancel-queued',
    threadId,
    ...(index !== undefined ? { index } : {}),
  })
}

/** Answer a pending approval request on a thread; queued to flush on reconnect (see `sendOrQueue`). */
export function respondAgentApproval(
  threadId: string,
  requestId: string,
  decision: ApprovalDecision,
): void {
  sendOrQueue({ t: 'agent:approve', threadId, requestId, decision })
}
