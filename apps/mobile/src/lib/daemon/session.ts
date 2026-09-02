import {
  createSessionHealth,
  type RemoteSessionHealth,
  type SessionHealth,
} from '@porcelain/client-runtime/remote'
import {
  createSessionClientRuntime,
  type SessionClientRuntime,
  type TerminalServerFrame,
} from '@porcelain/client-runtime/session/client-runtime'
import type { FreshnessRequirement } from '@porcelain/client-runtime/session/recovery'
import { REVOKED_CLOSE_CODE } from '@porcelain/client-runtime/session/transport'
import type { SessionChange, SessionMismatchFrame } from '@porcelain/contracts/session'
import { useMemo, useSyncExternalStore } from 'react'

import {
  createSessionNativeAdapter,
  type SessionConnectionStatus,
  type SessionNativeAdapter,
} from './session-native-adapter'

export type { SessionConnectionStatus }

/**
 * Mobile's binding between the shared session runtime and the React Native process: one
 * adapter, one runtime, and the foreground / credential close policy a phone owes its paired
 * daemon.
 *
 * Hello/ready, watches, change delivery, and recovery live in
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
  /** Shared remote health for the native adapter. */
  health(): RemoteSessionHealth
  /** The shared protocol runtime; feature adapters send only contract-typed frames through it. */
  readonly runtime: SessionClientRuntime
  /** Start the one native session socket; idempotent while it is active. */
  start(): void
  /** Subscribe to already-validated daemon → client Terminal stream frames. */
  onTerminalFrame(listener: (frame: TerminalServerFrame) => void): () => void
  /**
   * Fires after every successful ready INCLUDING the first. Anything queued while the protocol
   * handshakes waits on this generic lifecycle seam.
   */
  onDaemonReady(handler: () => void): () => void
  /** Fires after every successful ready AFTER the first one. */
  onDaemonReconnect(handler: () => void): () => void
  /** Fires when the protocol runtime is disconnected for any reason. */
  onDaemonClose(handler: () => void): () => void
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
}

const terminalListeners = new Set<(frame: TerminalServerFrame) => void>()
const reconnectHandlers = new Set<() => void>()
const openHandlers = new Set<() => void>()
const closeHandlers = new Set<() => void>()
const statusListeners = new Set<() => void>()
const changeObservers = new Set<SessionChangeObserver>()

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

function fireOpenHandlers(): void {
  for (const handler of [...openHandlers]) handler()
  const wasReady = everReady
  everReady = true
  if (wasReady) {
    for (const handler of [...reconnectHandlers]) handler()
  }
}

function fireCloseHandlers(): void {
  for (const handler of [...closeHandlers]) handler()
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
        fireCloseHandlers()
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
      core.disconnected()
      fireCloseHandlers()
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
const health = createSessionHealth()

const adapter: SessionNativeAdapter = createSessionNativeAdapter({
  runtime,
  endpoint: () => ({
    url: endpoint?.baseUrl ?? '',
    token: endpoint?.token ?? '',
  }),
  health,
  onStatusChange: setStatus,
  shouldReconnect: (code) => code !== REVOKED_CLOSE_CODE,
  onTransportClosed: async (code) => {
    if (code === REVOKED_CLOSE_CODE) {
      wanted = false
      await onClosed?.('revoked')
      return
    }
    // A live disconnect gets one HTTP endpoint walk before this socket retries. The provider
    // can therefore move to LAN, Tailscale, or Cloudflare instead of backing off against one dead URL.
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
  adapter.stop()
}

export const daemonSession: DaemonSession = {
  runtime,
  get status(): SessionConnectionStatus {
    return status
  },
  health(): RemoteSessionHealth {
    return health.status()
  },
  start(): void {
    ensureOpen()
  },
  onTerminalFrame(listener: (frame: TerminalServerFrame) => void): () => void {
    ensureOpen()
    terminalListeners.add(listener)
    return () => {
      terminalListeners.delete(listener)
    }
  },
  onDaemonReconnect(handler: () => void): () => void {
    reconnectHandlers.add(handler)
    return () => {
      reconnectHandlers.delete(handler)
    }
  },
  onDaemonReady(handler: () => void): () => void {
    ensureOpen()
    openHandlers.add(handler)
    return () => {
      openHandlers.delete(handler)
    }
  },
  onDaemonClose(handler: () => void): () => void {
    closeHandlers.add(handler)
    return () => {
      closeHandlers.delete(handler)
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
  } else {
    // A session's watches are scoped to a project. When an Environment switch has no selected
    // Worktree yet, the shared runtime still remembers the previous path (it deliberately has
    // no "unselect" protocol operation). Do not reopen a fresh daemon connection against that
    // stale path; selecting a Worktree will configure this session again and replace it.
    wanted = false
  }
  if (changed) {
    everReady = false
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

/** The shared remote health machine owned by this process's native adapter. */
export function sessionHealth(): SessionHealth {
  return health
}

/** Terminal protocol refusal: retire the socket and stop reconnecting. */
export function markSessionUpdateRequired(): void {
  adapter.updateRequired()
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
