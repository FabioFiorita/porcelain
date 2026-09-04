import { createSessionHealth, type RemoteSessionHealth } from '@porcelain/client-runtime/remote'
import {
  createSessionClientRuntime,
  type SessionClientRuntime,
  type TerminalServerFrame,
} from '@porcelain/client-runtime/session/client-runtime'
import type { FreshnessRequirement } from '@porcelain/client-runtime/session/recovery'
import type { SessionChange, SessionMismatchFrame } from '@porcelain/contracts/session'
import {
  createSessionBrowserAdapter,
  type SessionBrowserAdapter,
  type SessionConnectionStatus,
  type SessionRetrySchedule,
  type SessionSocketOpener,
} from './session-browser-adapter'

/**
 * One daemon connection: HTTP base for tRPC plus ONE `/session` WebSocket for change
 * signals, watches, and terminal bytes. Owns the shared runtime + browser adapter so
 * terminal I/O and query invalidation never open a second socket. `primary` is the
 * window's bound session; see `local-daemon.ts` for a second local session. Lib-only
 * (Biome). Reconnect fires generic recovery handlers; Terminal behavior lives in the Web feature.
 */

/** Browser client token persistence key (packaged app uses the preload bridge). */
const BROWSER_TOKEN_KEY = 'porcelain-client-token'

function initialToken(): string {
  const fromBridge = window.porcelain?.daemon?.token
  if (fromBridge !== undefined) return fromBridge
  return localStorage.getItem(BROWSER_TOKEN_KEY) ?? ''
}

/** Where a session points. An empty `url` means "the page origin" (the browser client is served BY its daemon). */
export interface DaemonEndpoint {
  url: string
  token: string
}

export type DaemonSessionOptions = {
  /** Injectable WebSocket opener (tests). Production uses the browser default. */
  readonly openSocket?: SessionSocketOpener
  /** Injectable reconnect timer (tests). Production uses `window.setTimeout`. */
  readonly schedule?: SessionRetrySchedule
}

export interface DaemonSession {
  /** The daemon's HTTP origin, resolved (page origin when the raw url is empty). */
  baseUrl: () => string
  /** The session token every request must carry ('' only on the browser path, which defines its own auth). */
  token: () => string
  /** The raw endpoint as stored — unlike `baseUrl()`, an empty url stays empty. */
  endpoint: () => DaemonEndpoint
  /** Re-point this session and reconnect immediately, skipping any pending backoff. */
  setEndpoint: (endpoint: DaemonEndpoint) => void
  /**
   * The shared session runtime for this daemon connection. The Terminal feature and
   * `useSessionRuntime` both use this instance — never construct a second one.
   */
  runtime: SessionClientRuntime
  /** Open the session socket (idempotent). Called lazily by terminal APIs and on shell mount. */
  start: () => void
  /** Close the session socket and cancel reconnect work when its owner is removed. */
  stop: () => void
  /** Browser adapter connection status for UI chrome. */
  status: () => SessionConnectionStatus
  /** Shared remote health for this session; a single-URL adapter is never walk-exhausted. */
  health: () => RemoteSessionHealth
  /** Set when the daemon refused this build's protocol (terminal mismatch). */
  updateRequiredFrame: () => SessionMismatchFrame | undefined
  onStatusChange: (listener: (status: SessionConnectionStatus) => void) => () => void
  onUpdateRequired: (listener: (frame: SessionMismatchFrame) => void) => () => void
  onChange: (listener: (change: SessionChange) => void) => () => void
  onFreshnessRequired: (listener: (requirement: FreshnessRequirement) => void) => () => void
  /** Forward a complete contract-valid Terminal server frame; no Terminal semantics live here. */
  onTerminalFrame: (listener: (frame: TerminalServerFrame) => void) => () => void
  /** Fires after every successful shared-runtime handshake, before reconnect listeners. */
  onDaemonReady: (listener: () => void) => () => void
  onDaemonReconnect: (listener: () => void) => () => void
  /** Fires when the primary socket dies; the shell can resolve a group's next route. */
  onDaemonClose: (listener: () => void) => () => void
}

/**
 * Build a session pointed at one daemon. Each instance owns its own runtime,
 * adapter, listener sets, and reconnect state — nothing is shared, so a second session cannot
 * affect the first session's transport lifecycle.
 */
export function createDaemonSession(
  initial: DaemonEndpoint,
  options: DaemonSessionOptions = {},
): DaemonSession {
  let baseUrl = initial.url
  let token = initial.token

  const terminalFrameListeners = new Set<(frame: TerminalServerFrame) => void>()
  const readyListeners = new Set<() => void>()
  const reconnectListeners = new Set<() => void>()
  const closeListeners = new Set<() => void>()
  const changeListeners = new Set<(change: SessionChange) => void>()
  const freshnessListeners = new Set<(requirement: FreshnessRequirement) => void>()
  const statusListeners = new Set<(status: SessionConnectionStatus) => void>()
  const updateRequiredListeners = new Set<(frame: SessionMismatchFrame) => void>()

  // Set when the shell pushes a fresh daemon url (the daemon came up late or was
  // restarted): the NEXT successful ready must refetch queries even if this is
  // the first-ever ready — boot queries errored against the dead/absent daemon.
  let recoveryPending = false
  // True after the first completed handshake; subsequent readies re-attach terminals
  // and notify reconnect listeners.
  let everSessionOpen = false
  // True for the current connection after the ready lifecycle has fired once.
  let openGenerationHandled = false

  let connectionStatus: SessionConnectionStatus = 'idle'
  let updateRequired: SessionMismatchFrame | undefined

  function dispatchTerminalFrame(frame: TerminalServerFrame): void {
    for (const listener of terminalFrameListeners) listener(frame)
  }

  function onBecameOpen(): void {
    for (const listener of readyListeners) listener()
    // Refetch on every REconnect — and on the first ready after the shell pushed a
    // fresh url (the daemon came up late; boot queries errored and must recover now).
    if (everSessionOpen || recoveryPending) {
      for (const listener of reconnectListeners) listener()
    }
    recoveryPending = false
    everSessionOpen = true
  }

  // Assigned after the runtime wrapper below; onUpdateRequired retires the transport
  // only once a mismatch arrives (never during construction).
  let adapter: SessionBrowserAdapter

  const baseRuntime = createSessionClientRuntime({
    observer: {
      onChange: (change: SessionChange): void => {
        for (const listener of changeListeners) listener(change)
      },
      onFreshnessRequired: (requirement: FreshnessRequirement): void => {
        for (const listener of freshnessListeners) listener(requirement)
      },
      onTerminalFrame: dispatchTerminalFrame,
      onUpdateRequired: (frame: SessionMismatchFrame): void => {
        updateRequired = frame
        for (const listener of updateRequiredListeners) listener(frame)
        adapter.updateRequired()
      },
    },
  })

  // After every inbound frame, detect the transition into protocol-open so generic ready
  // subscribers can finish adapter-owned work. The runtime does not expose an onReady hook;
  // receive is the authoritative path that completes the handshake.
  const runtime: SessionClientRuntime = {
    connected: (transport) => baseRuntime.connected(transport),
    receive: (raw) => {
      baseRuntime.receive(raw)
      if (baseRuntime.status() === 'open' && !openGenerationHandled) {
        openGenerationHandled = true
        onBecameOpen()
      }
    },
    disconnected: () => {
      openGenerationHandled = false
      baseRuntime.disconnected()
      for (const listener of closeListeners) listener()
    },
    send: (frame) => baseRuntime.send(frame),
    selectProject: (projectPath) => baseRuntime.selectProject(projectPath),
    registerWatchInterest: (interest) => baseRuntime.registerWatchInterest(interest),
    status: () => baseRuntime.status(),
    epoch: () => baseRuntime.epoch(),
    projectPath: () => baseRuntime.projectPath(),
  }

  const health = createSessionHealth()

  adapter = createSessionBrowserAdapter({
    runtime,
    endpoint: () => ({ url: baseUrl, token }),
    openSocket: options.openSocket,
    schedule: options.schedule,
    health,
    onStatusChange: (status) => {
      connectionStatus = status
      for (const listener of statusListeners) listener(status)
    },
  })

  /** The daemon's HTTP origin. Falls back to the page origin because the daemon serves its browser client same-origin. */
  function resolvedBaseUrl(): string {
    return baseUrl !== '' ? baseUrl : window.location.origin
  }

  function ensureSession(): void {
    adapter.start()
  }

  function reconnectNow(): void {
    recoveryPending = true
    openGenerationHandled = false
    adapter.stop()
    adapter.start()
  }

  function subscribe<T>(set: Set<T>, listener: T, start = true): () => void {
    if (start) ensureSession()
    set.add(listener)
    return () => {
      set.delete(listener)
    }
  }

  return {
    baseUrl: resolvedBaseUrl,
    token: () => token,
    endpoint: () => ({ url: baseUrl, token }),
    setEndpoint: (next: DaemonEndpoint): void => {
      baseUrl = next.url
      token = next.token
      reconnectNow()
    },
    runtime,
    start: ensureSession,
    stop: () => adapter.stop(),
    status: () => connectionStatus,
    health: () => health.status(),
    updateRequiredFrame: () => updateRequired,
    onStatusChange: (listener) => subscribe(statusListeners, listener, false),
    onUpdateRequired: (listener) => subscribe(updateRequiredListeners, listener, false),
    onChange: (listener) => subscribe(changeListeners, listener, false),
    onFreshnessRequired: (listener) => subscribe(freshnessListeners, listener, false),
    onTerminalFrame: (listener: (frame: TerminalServerFrame) => void) =>
      subscribe(terminalFrameListeners, listener),
    onDaemonReady: (listener: () => void) => subscribe(readyListeners, listener),
    /** Fires after the session comes BACK (never on the first connect) — queries are stale, refetch. */
    onDaemonReconnect: (listener: () => void) => subscribe(reconnectListeners, listener),
    // A close observer must not make an otherwise-unused secondary Environment live. The
    // session owner starts it when a panel needs it; this only reacts once that session dies.
    onDaemonClose: (listener: () => void) => subscribe(closeListeners, listener, false),
  }
}

/**
 * THE session — the daemon this window is bound to (local child or a remote one). Every
 * surface goes through the delegating exports below; a second session exists only where a
 * feature deliberately needs another machine (see `local-daemon.ts`).
 */
export const primary = createDaemonSession({
  url: window.porcelain?.daemon?.url ?? '',
  token: initialToken(),
})

// A daemon restart lands on a new port: adopt the url (+ token — stable per app
// run, re-sent for one payload shape), drop the socket aimed at the dead
// process, and reconnect immediately (skipping any pending backoff).
window.porcelain?.daemon?.onUrlChanged((info) => {
  primary.setEndpoint({ url: info.url, token: info.token })
})

/** Persist a browser-client token and reconnect (packaged app uses the bridge). */
export function setBrowserDaemonToken(newToken: string): void {
  localStorage.setItem(BROWSER_TOKEN_KEY, newToken)
  primary.setEndpoint({ url: primary.endpoint().url, token: newToken })
}

// Singleton API bound to `primary`. Name a session explicitly for another machine.
export const daemonBaseUrl: DaemonSession['baseUrl'] = primary.baseUrl
export const daemonToken: DaemonSession['token'] = primary.token
export const onTerminalFrame: DaemonSession['onTerminalFrame'] = primary.onTerminalFrame
export const onDaemonReady: DaemonSession['onDaemonReady'] = primary.onDaemonReady
export const onDaemonReconnect: DaemonSession['onDaemonReconnect'] = primary.onDaemonReconnect
export const onDaemonClose: DaemonSession['onDaemonClose'] = primary.onDaemonClose
