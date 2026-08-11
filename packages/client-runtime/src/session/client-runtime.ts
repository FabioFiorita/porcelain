import { PROTOCOL_VERSION } from '@porcelain/contracts'
import {
  type SessionChange,
  type SessionMismatchFrame,
  sessionChangeFrameSchema,
  sessionHelloFrameSchema,
  sessionMismatchFrameSchema,
  sessionReadyFrameSchema,
} from '@porcelain/contracts/session'
import {
  type TerminalInputFrame,
  type TerminalLifecycleFrame,
  type TerminalOutputFrame,
  terminalInputFrameSchema,
  terminalLifecycleFrameSchema,
  terminalOutputFrameSchema,
} from '@porcelain/contracts/terminal'
import {
  createWatchInterestRegistry,
  type WatchInterest,
  type WatchInterestRegistration,
  watchesFrameFor,
} from './interests'
import { createSessionFreshnessTracker, type FreshnessRequirement } from './recovery'

/**
 * The shared client session runtime: what a connected client says, in what order, and what it
 * owes its UI when the connection can no longer prove freshness. One state machine for Web and
 * mobile, so neither invents its own reconnect, sequence-gap, or watch-registration semantics.
 *
 * Transport-neutral on purpose. It is handed a `SessionClientTransport` — one `send` — and told
 * when a connection opened, what arrived on it, and when it dropped. It owns no socket, no URL,
 * no token, no backoff, and no timer; those stay with the adapter that owns the platform's
 * WebSocket (`RT-004`, `RT-005`). That is what makes the whole protocol table-testable against a
 * fake transport instead of a port.
 *
 * The order mirrors the daemon gateway's (`apps/daemon/src/session/session-gateway.ts`):
 *
 * ```text
 * connected  →  hello  →  ready  →  watches  →  changes / terminal frames
 *                           ↓ mismatch
 *                    update-required, terminal — no retry
 * ```
 *
 * Watches are sent after *every* ready, including when no consumer holds an interest. A session
 * that never registers receives no change frames at all, so "I want nothing right now" is a
 * message that must actually be sent rather than an optimization to skip. It needs a project:
 * interests are project-scoped by contract, and the daemon leaves a session that has not
 * declared one unscoped and silent. Selecting a project later sends the registration then.
 *
 * A protocol mismatch is terminal. The daemon does not emulate older clients and this runtime
 * does not retry into one: the state is reported once and the runtime stops speaking until a
 * compatible client is installed. Reconnecting through it would be an infinite loop against a
 * daemon that has already given its final answer.
 *
 * Raw frames never leave this module. Adapters see domain changes, terminal stream frames, and
 * refresh requirements — never a socket event.
 */

/** Everything the runtime needs from a connection. The adapter owns opening and closing it. */
export type SessionClientTransport = {
  readonly send: (payload: string) => void
}

/**
 * Daemon → client terminal traffic: ordered PTY output and the replies around it, selected from
 * the contract's own unions rather than recomposed. The frames a *client* sends
 * (`terminal:create`, `terminal:write`, the paste requests) are not accepted inbound, so a peer
 * cannot feed this client an echo of its own commands.
 */
const SERVER_LIFECYCLE_FRAME_TYPES = new Set<string>([
  'terminal:created',
  'terminal:attached',
  'terminal:exit',
])
const SERVER_PASTE_REPLY_TYPES = new Set<string>(['terminal:image-pasted', 'terminal:file-pasted'])

type ServerLifecycleFrame = Extract<
  TerminalLifecycleFrame,
  { t: 'terminal:created' | 'terminal:attached' | 'terminal:exit' }
>
type ServerPasteReplyFrame = Extract<
  TerminalInputFrame,
  { t: 'terminal:image-pasted' | 'terminal:file-pasted' }
>
export type TerminalServerFrame = ServerLifecycleFrame | TerminalOutputFrame | ServerPasteReplyFrame

function isServerLifecycleFrame(frame: TerminalLifecycleFrame): frame is ServerLifecycleFrame {
  return SERVER_LIFECYCLE_FRAME_TYPES.has(frame.t)
}

function isServerPasteReplyFrame(frame: TerminalInputFrame): frame is ServerPasteReplyFrame {
  return SERVER_PASTE_REPLY_TYPES.has(frame.t)
}

function parseTerminalServerFrame(frame: unknown): TerminalServerFrame | undefined {
  const lifecycle = terminalLifecycleFrameSchema.safeParse(frame)
  if (lifecycle.success) {
    return isServerLifecycleFrame(lifecycle.data) ? lifecycle.data : undefined
  }
  const output = terminalOutputFrameSchema.safeParse(frame)
  if (output.success) return output.data
  const input = terminalInputFrameSchema.safeParse(frame)
  if (input.success && isServerPasteReplyFrame(input.data)) return input.data
  return undefined
}

/**
 * How the runtime reports to its adapter.
 *
 * `onChange` is a freshness signal, never data: the adapter maps it to the queries it
 * invalidates. `onFreshnessRequired` is the authoritative version of the same instruction for a
 * scope the runtime can no longer vouch for. `onTerminalFrame` is a separate ordered path —
 * terminal is a stateful stream, it consumes no `sequence`, and a chatty shell can never look
 * like a gap in the change stream.
 */
export type SessionRuntimeObserver = {
  readonly onChange: (change: SessionChange) => void
  readonly onTerminalFrame: (frame: TerminalServerFrame) => void
  readonly onFreshnessRequired: (requirement: FreshnessRequirement) => void
  readonly onUpdateRequired: (frame: SessionMismatchFrame) => void
}

/**
 * `handshaking` has sent hello and is waiting; `open` completed the handshake; `disconnected`
 * lost a connection and may be reconnected by the adapter; `update-required` is terminal.
 */
export type SessionRuntimeStatus =
  | 'idle'
  | 'handshaking'
  | 'open'
  | 'disconnected'
  | 'update-required'

export type SessionClientRuntime = {
  /** A connection opened. Sends `session:hello` as its first frame. */
  readonly connected: (transport: SessionClientTransport) => void
  /** One raw frame exactly as it arrived off the wire. */
  readonly receive: (raw: string) => void
  /** The connection dropped. The adapter decides whether and when to reconnect. */
  readonly disconnected: () => void
  /**
   * Send one client frame on the open session (terminal stream commands, etc.).
   * No-op until `ready`; adapters never open a second socket for terminal traffic.
   */
  readonly send: (frame: unknown) => void
  /** Declare the project this session watches; interests are scoped to it. */
  readonly selectProject: (projectPath: string) => void
  /** Declare a watch interest, held until the returned registration is released. */
  readonly registerWatchInterest: (interest: WatchInterest) => WatchInterestRegistration
  readonly status: () => SessionRuntimeStatus
  /** The daemon instance every accepted `sequence` is attributed to. */
  readonly epoch: () => string | undefined
  /** The project currently declared, or `undefined` before one is selected. */
  readonly projectPath: () => string | undefined
}

function readJson(raw: string): unknown {
  try {
    return JSON.parse(raw)
  } catch {
    return null
  }
}

export function createSessionClientRuntime({
  observer,
}: {
  observer: SessionRuntimeObserver
}): SessionClientRuntime {
  const tracker = createSessionFreshnessTracker()
  const interests = createWatchInterestRegistry()
  let status: SessionRuntimeStatus = 'idle'
  let transport: SessionClientTransport | undefined
  let projectPath: string | undefined

  const send = (frame: unknown): void => {
    transport?.send(JSON.stringify(frame))
  }

  const sendWatches = (): void => {
    // No project means no registration the contract can express, and a session the daemon
    // leaves unscoped receives nothing — which is the correct answer for a client that has
    // not said what it is looking at.
    if (status !== 'open' || projectPath === undefined) return
    send(watchesFrameFor({ projectPath, interests: interests.desired() }))
  }

  const handleReady = (frame: unknown): void => {
    const parsed = sessionReadyFrameSchema.safeParse(frame)
    if (!parsed.success) return
    status = 'open'
    const requirement = tracker.ready({ epoch: parsed.data.epoch })
    // Re-register before recovering: the refresh the adapter is about to run should land on a
    // session whose interests are already restored, or the data it refetches goes uncovered
    // again immediately (decision 009's recovery order).
    sendWatches()
    if (requirement) observer.onFreshnessRequired(requirement)
  }

  const handleMismatch = (frame: unknown): boolean => {
    const parsed = sessionMismatchFrameSchema.safeParse(frame)
    if (!parsed.success) return false
    // Terminal. No further frame is sent on this or any later connection.
    status = 'update-required'
    transport = undefined
    observer.onUpdateRequired(parsed.data)
    return true
  }

  const handleOpenFrame = (frame: unknown): void => {
    const parsed = sessionChangeFrameSchema.safeParse(frame)
    if (!parsed.success) {
      // The socket is a network boundary even on loopback: anything that does not validate as
      // one of the frames this client accepts is dropped rather than guessed at.
      const terminalFrame = parseTerminalServerFrame(frame)
      if (terminalFrame) observer.onTerminalFrame(terminalFrame)
      return
    }
    const observed = tracker.observe(parsed.data)
    // Stale first, then the signal: both are idempotent, and marking the scope before applying
    // the change keeps a refetch from being invalidated by the very requirement it answered.
    if (observed.requirement) observer.onFreshnessRequired(observed.requirement)
    observer.onChange(observed.change)
  }

  return {
    connected(nextTransport) {
      if (status === 'update-required') return
      transport = nextTransport
      status = 'handshaking'
      send(sessionHelloFrameSchema.parse({ t: 'session:hello', protocolVersion: PROTOCOL_VERSION }))
    },

    receive(raw) {
      if (status === 'update-required' || status === 'idle' || status === 'disconnected') return
      const frame = readJson(raw)
      if (status === 'handshaking') {
        if (handleMismatch(frame)) return
        handleReady(frame)
        return
      }
      handleOpenFrame(frame)
    },

    disconnected() {
      if (status === 'update-required') return
      transport = undefined
      status = 'disconnected'
      tracker.disconnected()
    },

    send(frame) {
      if (status !== 'open') return
      send(frame)
    },

    selectProject(nextProjectPath) {
      if (projectPath === nextProjectPath) return
      projectPath = nextProjectPath
      sendWatches()
    },

    registerWatchInterest(interest) {
      const registration = interests.register(interest)
      sendWatches()
      return {
        release() {
          registration.release()
          sendWatches()
        },
      }
    },

    status() {
      return status
    },

    epoch() {
      return tracker.epoch()
    },

    projectPath() {
      return projectPath
    },
  }
}
