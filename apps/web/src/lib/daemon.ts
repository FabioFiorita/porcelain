import {
  createSessionClientRuntime,
  type SessionClientRuntime,
  type TerminalServerFrame,
} from '@porcelain/client-runtime/session/client-runtime'
import type { FreshnessRequirement } from '@porcelain/client-runtime/session/recovery'
import type { SessionChange, SessionMismatchFrame } from '@porcelain/contracts/session'
import { MAX_TERMINAL_WRITE_CODE_UNITS } from '@porcelain/contracts/terminal'
import {
  createSessionBrowserAdapter,
  type SessionBrowserAdapter,
  type SessionConnectionStatus,
  type SessionRetrySchedule,
  type SessionSocketOpener,
} from './session-browser-adapter'
import { randomId } from './utils'

/**
 * One daemon connection: HTTP base for tRPC plus ONE `/session` WebSocket for change
 * signals, watches, and terminal bytes. Owns the shared runtime + browser adapter so
 * terminal I/O and query invalidation never open a second socket. `primary` is the
 * window's bound session; see `local-daemon.ts` for a second local session. Lib-only
 * (Biome). Reconnect re-attaches terminals and fires recovery handlers.
 */

/** Browser client token persistence key (packaged app uses the preload bridge). */
const BROWSER_TOKEN_KEY = 'porcelain-client-token'

function initialToken(): string {
  const fromBridge = window.porcelain?.daemon?.token
  if (fromBridge !== undefined) return fromBridge
  return localStorage.getItem(BROWSER_TOKEN_KEY) ?? ''
}

export interface AttachResult {
  scrollback: string
  status: 'running' | 'exited'
  exitCode?: number
  found: boolean
}

export interface PasteImageResult {
  result: 'ok' | 'too-large' | 'no-session' | 'write-failed'
  path?: string
}

export type PasteFileResult = PasteImageResult

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
   * The shared session runtime for this daemon connection. Terminal APIs and
   * `useSessionRuntime` both use this instance — never construct a second one.
   */
  runtime: SessionClientRuntime
  /** Open the session socket (idempotent). Called lazily by terminal APIs and on shell mount. */
  start: () => void
  /** Browser adapter connection status for UI chrome. */
  status: () => SessionConnectionStatus
  /** Set when the daemon refused this build's protocol (terminal mismatch). */
  updateRequiredFrame: () => SessionMismatchFrame | undefined
  onStatusChange: (listener: (status: SessionConnectionStatus) => void) => () => void
  onUpdateRequired: (listener: (frame: SessionMismatchFrame) => void) => () => void
  onChange: (listener: (change: SessionChange) => void) => () => void
  onFreshnessRequired: (listener: (requirement: FreshnessRequirement) => void) => () => void
  onTerminalData: (listener: (id: string, data: string) => void) => () => void
  onTerminalExit: (listener: (id: string, exitCode: number) => void) => () => void
  onTerminalScrollback: (listener: (id: string, scrollback: string) => void) => () => void
  onDaemonReconnect: (listener: () => void) => () => void
  /** Fires when the primary socket dies; the shell can resolve a group's next route. */
  onDaemonClose: (listener: () => void) => () => void
  createTerminal: (opts: {
    name: string
    cwd: string
    initialInput?: string
    cols?: number
    rows?: number
  }) => Promise<string>
  attachTerminal: (id: string) => Promise<AttachResult>
  detachTerminal: (id: string) => void
  isTerminalAttached: (id: string) => boolean
  writeTerminal: (id: string, data: string) => void
  resizeTerminal: (id: string, cols: number, rows: number) => void
  killTerminal: (id: string) => void
  pasteImageToTerminal: (
    id: string,
    mime: 'image/png' | 'image/jpeg' | 'image/gif' | 'image/webp',
    dataBase64: string,
  ) => Promise<PasteImageResult>
  pasteFileToTerminal: (
    id: string,
    filename: string,
    mime: string,
    dataBase64: string,
  ) => Promise<PasteFileResult>
}

/**
 * Build a session pointed at one daemon. Each instance owns its own runtime,
 * adapter, listener sets, pending-request maps, and reconnect state — nothing is
 * shared, so a second session can't fail the first's in-flight creates.
 */
export function createDaemonSession(
  initial: DaemonEndpoint,
  options: DaemonSessionOptions = {},
): DaemonSession {
  let baseUrl = initial.url
  let token = initial.token

  const dataListeners = new Set<(id: string, data: string) => void>()
  const exitListeners = new Set<(id: string, exitCode: number) => void>()
  const scrollbackListeners = new Set<(id: string, scrollback: string) => void>()
  const reconnectListeners = new Set<() => void>()
  const closeListeners = new Set<() => void>()
  const changeListeners = new Set<(change: SessionChange) => void>()
  const freshnessListeners = new Set<(requirement: FreshnessRequirement) => void>()
  const statusListeners = new Set<(status: SessionConnectionStatus) => void>()
  const updateRequiredListeners = new Set<(frame: SessionMismatchFrame) => void>()

  interface PendingCreate {
    resolve: (id: string) => void
    reject: (error: Error) => void
  }
  const pendingCreates = new Map<string, PendingCreate>()
  interface PendingAttach {
    resolve: (result: AttachResult) => void
    reject: (error: Error) => void
  }
  const pendingAttaches = new Map<string, PendingAttach>()
  interface PendingPaste {
    resolve: (result: PasteImageResult) => void
    reject: (error: Error) => void
  }
  const pendingPastes = new Map<string, PendingPaste>()
  const pendingFiles = new Map<string, PendingPaste>()
  // The ids this client is currently streaming — re-sent as `terminal:attach` on every
  // reconnect (the daemon's attached-sender set died with the old socket), with the fresh
  // scrollback routed through the scrollback listeners so the registry can replay it.
  const attachedIds = new Set<string>()

  // Creates/attaches/pastes issued while the session is still handshaking are queued and
  // flushed on ready; fire-and-forget messages (write/resize/kill) are not — a dead
  // socket means dead PTYs. Both the queue and the in-flight requests die with the socket.
  const outbox: unknown[] = []

  // Set when the shell pushes a fresh daemon url (the daemon came up late or was
  // restarted): the NEXT successful ready must refetch queries even if this is
  // the first-ever ready — boot queries errored against the dead/absent daemon.
  let recoveryPending = false
  // True after the first completed handshake; subsequent readies re-attach terminals
  // and notify reconnect listeners.
  let everSessionOpen = false
  // True for the current connection after we have flushed the post-ready work once.
  let openGenerationHandled = false

  let connectionStatus: SessionConnectionStatus = 'idle'
  let updateRequired: SessionMismatchFrame | undefined

  function dispatchTerminalFrame(frame: TerminalServerFrame): void {
    switch (frame.t) {
      case 'terminal:data':
        for (const listener of dataListeners) listener(frame.id, frame.data)
        break
      case 'terminal:exit':
        for (const listener of exitListeners) listener(frame.id, frame.exitCode)
        break
      case 'terminal:created': {
        const pending = pendingCreates.get(frame.reqId)
        if (pending) {
          pendingCreates.delete(frame.reqId)
          pending.resolve(frame.id)
        }
        break
      }
      case 'terminal:attached': {
        // Route the replay scrollback to the registry before any live data follows
        // (the daemon sends this reply before subsequent terminal:data), then settle
        // the pending attach promise for the caller that awaited the initial attach.
        for (const listener of scrollbackListeners) listener(frame.id, frame.scrollback)
        const pending = pendingAttaches.get(frame.reqId)
        if (pending) {
          pendingAttaches.delete(frame.reqId)
          pending.resolve({
            scrollback: frame.scrollback,
            status: frame.status,
            exitCode: frame.exitCode,
            found: frame.found,
          })
        }
        break
      }
      case 'terminal:image-pasted': {
        const pending = pendingPastes.get(frame.reqId)
        if (pending) {
          pendingPastes.delete(frame.reqId)
          pending.resolve({ path: frame.path, result: frame.result })
        }
        break
      }
      case 'terminal:file-pasted': {
        const pending = pendingFiles.get(frame.reqId)
        if (pending) {
          pendingFiles.delete(frame.reqId)
          pending.resolve({ path: frame.path, result: frame.result })
        }
        break
      }
    }
  }

  /** Fail every in-flight/queued create + attach + paste — their socket is gone. */
  function failPending(reason: string): void {
    outbox.length = 0
    const creates = [...pendingCreates.values()]
    pendingCreates.clear()
    for (const { reject } of creates) reject(new Error(reason))
    const attaches = [...pendingAttaches.values()]
    pendingAttaches.clear()
    for (const { reject } of attaches) reject(new Error(reason))
    const pastes = [...pendingPastes.values()]
    pendingPastes.clear()
    for (const { reject } of pastes) reject(new Error(reason))
    const files = [...pendingFiles.values()]
    pendingFiles.clear()
    for (const { reject } of files) reject(new Error(reason))
  }

  const DROP_REASON =
    'The Porcelain daemon connection dropped before the terminal could be created. Try again in a moment — the app reconnects automatically.'

  function onBecameOpen(): void {
    // Re-attach every terminal this client was streaming: the daemon's attached-sender
    // set died with the old socket. Not on the first-ever ready — those attaches are
    // already queued in the outbox (double-sending would replay scrollback twice).
    if (everSessionOpen) {
      for (const id of attachedIds) {
        baseRuntime.send({ t: 'terminal:attach', id, reqId: randomId() })
      }
    }
    for (const frame of outbox.splice(0)) baseRuntime.send(frame)
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

  // After every inbound frame, detect the transition into protocol-open so the
  // outbox can flush and terminals re-attach. The runtime does not expose an
  // onReady hook; receive is the authoritative path that completes the handshake.
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
      failPending(DROP_REASON)
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

  adapter = createSessionBrowserAdapter({
    runtime,
    endpoint: () => ({ url: baseUrl, token }),
    openSocket: options.openSocket,
    schedule: options.schedule,
    onStatusChange: (status) => {
      connectionStatus = status
      for (const listener of statusListeners) listener(status)
    },
  })

  /** The daemon's HTTP origin. Falls back to the page origin — Phase 3 serves the remote client FROM the daemon, making it same-origin. */
  function resolvedBaseUrl(): string {
    return baseUrl !== '' ? baseUrl : window.location.origin
  }

  function ensureSession(): void {
    adapter.start()
  }

  /** Send now if the protocol is open, else queue for the next ready. */
  function pushOrQueue(frame: unknown): void {
    if (runtime.status() === 'open') runtime.send(frame)
    else outbox.push(frame)
  }

  /** Fire-and-forget: only lands on an open session (writes into a dead socket are dropped). */
  function push(frame: unknown): void {
    if (runtime.status() === 'open') runtime.send(frame)
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
    status: () => connectionStatus,
    updateRequiredFrame: () => updateRequired,
    onStatusChange: (listener) => subscribe(statusListeners, listener, false),
    onUpdateRequired: (listener) => subscribe(updateRequiredListeners, listener, false),
    onChange: (listener) => subscribe(changeListeners, listener, false),
    onFreshnessRequired: (listener) => subscribe(freshnessListeners, listener, false),
    onTerminalData: (listener: (id: string, data: string) => void) =>
      subscribe(dataListeners, listener),
    onTerminalExit: (listener: (id: string, exitCode: number) => void) =>
      subscribe(exitListeners, listener),
    /**
     * Fires with a session's replay scrollback on attach (both the initial attach and every
     * reconnect re-attach). The registry replays it into the Ghostty before live data follows.
     */
    onTerminalScrollback: (listener: (id: string, scrollback: string) => void) =>
      subscribe(scrollbackListeners, listener),
    /** Fires after the session comes BACK (never on the first connect) — queries are stale, refetch. */
    onDaemonReconnect: (listener: () => void) => subscribe(reconnectListeners, listener),
    onDaemonClose: (listener: () => void) => subscribe(closeListeners, listener),

    /**
     * Spawn a PTY; resolves with its id via the reqId-correlated `terminal:created`
     * reply. Rejects if the session drops before the daemon answers (the socket's
     * close fails all in-flight creates) — callers surface the error instead of
     * hanging on a promise that can never settle.
     */
    createTerminal: (opts: {
      name: string
      cwd: string
      initialInput?: string
      cols?: number
      rows?: number
    }): Promise<string> => {
      ensureSession()
      return new Promise<string>((resolve, reject) => {
        const reqId = randomId()
        pendingCreates.set(reqId, {
          // The creator is auto-attached daemon-side — track the id so a later reconnect
          // re-attaches it like any other streaming terminal.
          resolve: (id: string): void => {
            attachedIds.add(id)
            resolve(id)
          },
          reject,
        })
        pushOrQueue({ t: 'terminal:create', reqId, ...opts })
      })
    },
    /**
     * Attach to a daemon-owned PTY (opening a session hydrated from the roster after a
     * reload, or a second view of one already running) and resolve with its replay
     * scrollback + state. The scrollback is ALSO pushed through `onTerminalScrollback` (the
     * registry's replay path); the promise result is for the caller that needs the state
     * (e.g. an already-exited session). Rejects if the socket drops before the daemon
     * answers, like create. Re-attaches automatically on every reconnect thereafter.
     */
    attachTerminal: (id: string): Promise<AttachResult> => {
      ensureSession()
      attachedIds.add(id)
      return new Promise<AttachResult>((resolve, reject) => {
        const reqId = randomId()
        pendingAttaches.set(reqId, {
          resolve,
          // A socket drop before the reply rejects this — drop the id so `isTerminalAttached`
          // reports false and the next roster hydrate re-attaches (the reconnect re-attach
          // loop only fires once everSessionOpen, so an initial-connect failure needs this).
          reject: (error: Error): void => {
            attachedIds.delete(id)
            reject(error)
          },
        })
        pushOrQueue({ t: 'terminal:attach', id, reqId })
      })
    },
    /** Stop streaming a PTY to this client without killing it (fire-and-forget). */
    detachTerminal: (id: string): void => {
      attachedIds.delete(id)
      push({ t: 'terminal:detach', id })
    },
    /** Whether this client is currently streaming `id` — so a caller doesn't re-attach it. */
    isTerminalAttached: (id: string) => attachedIds.has(id),
    writeTerminal: (id: string, data: string) => {
      for (let offset = 0; offset < data.length; offset += MAX_TERMINAL_WRITE_CODE_UNITS) {
        push({
          t: 'terminal:write',
          id,
          data: data.slice(offset, offset + MAX_TERMINAL_WRITE_CODE_UNITS),
        })
      }
    },
    resizeTerminal: (id: string, cols: number, rows: number) =>
      push({ t: 'terminal:resize', id, cols, rows }),
    killTerminal: (id: string): void => {
      attachedIds.delete(id)
      push({ t: 'terminal:kill', id })
    },
    /**
     * Send a pasted image to the daemon for `id`'s session. `pushOrQueue`, like create and
     * attach: the outbox only survives the initial handshaking window (cleared on any
     * close, per `failPending`), so this never replays a stale paste into whatever
     * the cursor is doing after a later reconnect — it only lets a paste tapped the instant
     * the socket is still opening ride the same flush a create would.
     */
    pasteImageToTerminal: (
      id: string,
      mime: 'image/png' | 'image/jpeg' | 'image/gif' | 'image/webp',
      dataBase64: string,
    ): Promise<PasteImageResult> => {
      ensureSession()
      return new Promise<PasteImageResult>((resolve, reject) => {
        const reqId = randomId()
        pendingPastes.set(reqId, { resolve, reject })
        pushOrQueue({ t: 'terminal:paste-image', id, reqId, mime, dataBase64 })
      })
    },
    pasteFileToTerminal: (
      id: string,
      filename: string,
      mime: string,
      dataBase64: string,
    ): Promise<PasteFileResult> => {
      ensureSession()
      return new Promise<PasteFileResult>((resolve, reject) => {
        const reqId = randomId()
        pendingFiles.set(reqId, { resolve, reject })
        pushOrQueue({ t: 'terminal:paste-file', id, reqId, filename, mime, dataBase64 })
      })
    },
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
export const onTerminalData: DaemonSession['onTerminalData'] = primary.onTerminalData
export const onTerminalExit: DaemonSession['onTerminalExit'] = primary.onTerminalExit
export const onTerminalScrollback: DaemonSession['onTerminalScrollback'] =
  primary.onTerminalScrollback
export const onDaemonReconnect: DaemonSession['onDaemonReconnect'] = primary.onDaemonReconnect
export const onDaemonClose: DaemonSession['onDaemonClose'] = primary.onDaemonClose
export const createTerminal: DaemonSession['createTerminal'] = primary.createTerminal
export const attachTerminal: DaemonSession['attachTerminal'] = primary.attachTerminal
export const detachTerminal: DaemonSession['detachTerminal'] = primary.detachTerminal
export const isTerminalAttached: DaemonSession['isTerminalAttached'] = primary.isTerminalAttached
export const writeTerminal: DaemonSession['writeTerminal'] = primary.writeTerminal
export const resizeTerminal: DaemonSession['resizeTerminal'] = primary.resizeTerminal
export const killTerminal: DaemonSession['killTerminal'] = primary.killTerminal
export const pasteImageToTerminal: DaemonSession['pasteImageToTerminal'] =
  primary.pasteImageToTerminal
export const pasteFileToTerminal: DaemonSession['pasteFileToTerminal'] = primary.pasteFileToTerminal
