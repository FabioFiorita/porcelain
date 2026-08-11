import {
  createSessionClientRuntime,
  type SessionClientRuntime,
  type TerminalServerFrame,
} from '@porcelain/client-runtime/session/client-runtime'
import type { FreshnessRequirement } from '@porcelain/client-runtime/session/recovery'
import { REQUEST_TIMEOUT_MS, REVOKED_CLOSE_CODE } from '@porcelain/client-runtime/session/transport'
import type { SessionChange, SessionMismatchFrame } from '@porcelain/contracts/session'
import { useMemo, useSyncExternalStore } from 'react'

import { DaemonError } from './errors'
import {
  createSessionNativeAdapter,
  type SessionConnectionStatus,
  type SessionNativeAdapter,
} from './session-native-adapter'

/**
 * Mobile's binding between the shared session runtime and the React Native process: one
 * adapter, one runtime, terminal request correlation, and the foreground / credential close
 * policy a phone owes its paired daemon.
 *
 * There is no legacy frame path. Hello/ready, watches, change delivery, and recovery live in
 * `@porcelain/client-runtime/session/client-runtime`. The native adapter owns the socket. This
 * module owns lifecycle that is not protocol — backgrounding, token revocation (4001), the
 * endpoint walk after a live drop, and the small listener surface terminal + provider use.
 */

export type SessionEndpoint = { baseUrl: string; token: string; repo: string | null }

/** `revoked` is the daemon's own verdict; `refused` needs an authenticated HTTP probe. */
export type SessionCloseReason = 'revoked' | 'refused'

export type SessionChangeObserver = {
  readonly onChange: (change: SessionChange) => void
  readonly onFreshnessRequired: (requirement: FreshnessRequirement) => void
  readonly onUpdateRequired?: (frame: SessionMismatchFrame) => void
}

export type DaemonSession = {
  readonly status: SessionConnectionStatus
  /** Send one client frame on the open session (terminal stream commands). No-op until ready. */
  send(frame: unknown): void
  /** Subscribe to daemon → client terminal stream frames. */
  subscribeTerminal(listener: (frame: TerminalServerFrame) => void): () => void
  /** Fires after every successful (re)handshake AFTER the first ready. */
  onReconnect(handler: () => void): () => void
  /**
   * Fires after every successful ready INCLUDING the first — `onReconnect` deliberately skips
   * that one. Anything that must not be pushed into a session still handshaking (a terminal
   * create/attach, which correlates a reply by `reqId`) waits on this instead.
   */
  onOpen(handler: () => void): () => void
  /**
   * Declare a watch interest (files/dirs). Held until the returned release runs. Interests are
   * project-scoped; call `selectProject` (or configure with a repo) first.
   */
  registerWatchInterest(interest: {
    files?: readonly string[]
    dirs?: readonly string[]
  }): () => void
  /** Declare the project this session watches. */
  selectProject(projectPath: string): void
  /**
   * Send a terminal request frame and resolve with the matching stream reply. Correlation is
   * by the caller's matcher (typically `reqId`); the request dies with the socket.
   */
  request<TReply>(
    frame: unknown,
    match: (frame: TerminalServerFrame) => TReply | null,
    options?: { timeoutMs?: number },
  ): Promise<TReply>
}

const terminalListeners = new Set<(frame: TerminalServerFrame) => void>()
const reconnectHandlers = new Set<() => void>()
const openHandlers = new Set<() => void>()
const statusListeners = new Set<() => void>()
const changeObservers = new Set<SessionChangeObserver>()
const pendingRejects = new Set<(error: DaemonError) => void>()

let endpoint: SessionEndpoint | null = null
let status: SessionConnectionStatus = 'idle'
let wanted = false
let foreground = true
let everReady = false
let onClosed: ((reason: SessionCloseReason) => Promise<void> | void) | null = null

function setStatus(next: SessionConnectionStatus): void {
  if (status === next) return
  status = next
  for (const listener of statusListeners) listener()
}

function failPending(message: string): void {
  const rejects = [...pendingRejects]
  pendingRejects.clear()
  for (const reject of rejects) reject(new DaemonError('unreachable', 'session', message))
}

function fireOpenHandlers(): void {
  if (everReady) {
    for (const handler of [...reconnectHandlers]) handler()
  }
  everReady = true
  for (const handler of [...openHandlers]) handler()
}

/**
 * Runtime whose `receive` surfaces ready transitions to open/reconnect handlers. The shared
 * runtime has no `onReady` observer; open is the state after a validated `session:ready`.
 */
function createMobileRuntime(): SessionClientRuntime {
  let wasOpen = false
  const core = createSessionClientRuntime({
    observer: {
      onChange(change) {
        for (const observer of [...changeObservers]) observer.onChange(change)
      },
      onFreshnessRequired(requirement) {
        for (const observer of [...changeObservers]) observer.onFreshnessRequired(requirement)
      },
      onTerminalFrame(frame) {
        for (const listener of [...terminalListeners]) listener(frame)
      },
      onUpdateRequired(frame) {
        for (const observer of [...changeObservers]) observer.onUpdateRequired?.(frame)
        adapter.updateRequired()
      },
    },
  })

  return {
    connected(transport) {
      wasOpen = false
      core.connected(transport)
    },
    receive(raw) {
      core.receive(raw)
      if (!wasOpen && core.status() === 'open') {
        wasOpen = true
        fireOpenHandlers()
      }
    },
    disconnected() {
      wasOpen = false
      failPending('The daemon connection dropped before the reply arrived.')
      core.disconnected()
    },
    send(frame) {
      core.send(frame)
    },
    selectProject(projectPath) {
      core.selectProject(projectPath)
    },
    registerWatchInterest(interest) {
      return core.registerWatchInterest(interest)
    },
    status() {
      return core.status()
    },
    epoch() {
      return core.epoch()
    },
    projectPath() {
      return core.projectPath()
    },
  }
}

const runtime = createMobileRuntime()

const adapter: SessionNativeAdapter = createSessionNativeAdapter({
  runtime,
  endpoint: () => ({
    url: endpoint?.baseUrl ?? '',
    token: endpoint?.token ?? '',
  }),
  onStatusChange: setStatus,
  shouldReconnect: (code) => code !== REVOKED_CLOSE_CODE,
  onTransportClosed: async (code) => {
    if (code === REVOKED_CLOSE_CODE) {
      wanted = false
      await onClosed?.('revoked')
      return
    }
    // A live disconnect gets one HTTP endpoint walk before this socket retries. The provider
    // can therefore move to LAN, Tailscale, or Funnel instead of backing off against one dead URL.
    if (everReady) await onClosed?.('refused')
  },
})

function ensureOpen(): void {
  if (endpoint === null || !foreground) return
  if (adapter.status() === 'update-required') return
  wanted = true
  // `start` is idempotent while connecting/open/reconnecting.
  adapter.start()
}

function stopAdapter(): void {
  failPending('The daemon connection closed.')
  adapter.stop()
}

export const daemonSession: DaemonSession = {
  get status(): SessionConnectionStatus {
    return status
  },
  send(frame: unknown): void {
    ensureOpen()
    runtime.send(frame)
  },
  subscribeTerminal(listener: (frame: TerminalServerFrame) => void): () => void {
    ensureOpen()
    terminalListeners.add(listener)
    return () => {
      terminalListeners.delete(listener)
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
  registerWatchInterest(interest: {
    files?: readonly string[]
    dirs?: readonly string[]
  }): () => void {
    ensureOpen()
    const registration = runtime.registerWatchInterest({
      files: interest.files ?? [],
      dirs: interest.dirs ?? [],
    })
    return () => registration.release()
  },
  selectProject(projectPath: string): void {
    runtime.selectProject(projectPath)
  },
  request<TReply>(
    frame: unknown,
    match: (reply: TerminalServerFrame) => TReply | null,
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
        fail(
          new DaemonError(
            'unreachable',
            typeof frame === 'object' && frame !== null && 't' in frame
              ? String((frame as { t: unknown }).t)
              : 'session',
            'The daemon did not answer in time.',
          ),
        )
      }, options?.timeoutMs ?? REQUEST_TIMEOUT_MS)
      // The matcher dies with the socket: a reply on a fresh socket must not settle a
      // request the daemon lost when the old one closed.
      pendingRejects.add(fail)
      const stop = daemonSession.subscribeTerminal((incoming) => {
        const reply = match(incoming)
        if (reply === null) return
        settle()
        resolve(reply)
      })
      runtime.send(frame)
    })
  },
}

/**
 * Subscribe to domain change signals and freshness requirements. Provider-only: maps each
 * signal onto React Query invalidation. Returns an unsubscribe.
 */
export function subscribeSessionChanges(observer: SessionChangeObserver): () => void {
  changeObservers.add(observer)
  return () => {
    changeObservers.delete(observer)
  }
}

/** Point the session at a daemon (or nowhere). Reconnects immediately — provider only. */
export function configureSession(next: SessionEndpoint | null): void {
  if (next === null) {
    endpoint = null
    wanted = false
    everReady = false
    stopAdapter()
    return
  }
  // Only the daemon identity forces a new socket; a repo change is `selectProject` on the live
  // one, because tearing the socket down would drop the terminals.
  const changed = endpoint?.baseUrl !== next.baseUrl || endpoint?.token !== next.token
  endpoint = next
  if (next.repo !== null) {
    runtime.selectProject(next.repo)
    // A project is the contract's scope for watches; open once one is known.
    wanted = true
  }
  if (changed) {
    everReady = false
    failPending('The daemon connection closed.')
    adapter.stop()
  }
  if (wanted && foreground) adapter.start()
}

/** Sockets die in the background and reopen on `active` — an idle phone holds no connection. */
export function setSessionForeground(active: boolean): void {
  foreground = active
  if (active) {
    if (wanted && endpoint !== null) adapter.start()
  } else {
    stopAdapter()
  }
}

/** How the provider learns a socket died for a credential reason rather than a network one. */
export function onSessionClosed(
  handler: (reason: SessionCloseReason) => Promise<void> | void,
): void {
  onClosed = handler
}

/** The shared runtime — interests and project selection for advanced callers / tests. */
export function sessionClientRuntime(): SessionClientRuntime {
  return runtime
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
