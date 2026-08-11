import type { ProtocolVersion } from '@porcelain/contracts'
import {
  sessionMismatchFrameSchema,
  sessionReadyFrameSchema,
  sessionWatchesFrameSchema,
} from '@porcelain/contracts/session'
import {
  type TerminalClientFrame,
  type TerminalServerFrame,
  terminalClientFrameSchema,
  terminalServerFrameSchema,
} from '@porcelain/contracts/terminal'
import { z } from 'zod'
import type { AuthIdentity } from '../stores/access-store'
import type { SessionChangePublisher } from './change-publisher'
import { decideSessionHandshake } from './session-handshake'
import { createSessionWatchInterests, type SessionWatchSink } from './session-watches'

export type { TerminalClientFrame, TerminalServerFrame }

/**
 * The daemon's session gateway: what an authenticated socket is allowed to do, in the order it
 * is allowed to do it. Authorization, handshake, subscriber lifecycle, watch registration, and
 * terminal stream forwarding meet here instead of being scattered across one connection class.
 *
 * Activated by `session/live-session.ts`: real sockets, terminal bridge over the terminal
 * manager, and Files watch sinks. Clients speak the versioned hello/ready gateway only.
 *
 * Transport-agnostic on purpose. No `ws` import, no socket type, no timers — a `SessionTransport`
 * is two functions, so the whole protocol is table-testable without opening a port, and the
 * authorization rules are provable rather than asserted.
 *
 * The order is the security property:
 *
 * ```text
 * upgrade authenticated  →  hello  →  ready  →  watches / terminal
 *          ↓ no identity      ↓ mismatch
 *        refused            frame sent, socket closed, nothing registered
 * ```
 *
 * A session that never reached `ready` has no subscription, no watch interests, and no terminal
 * attachment — the mismatch reply is the last thing it receives. Identity is the credential the
 * upgrade already checked (`daemon-http.ts` gates `/session` on the `porcelain.<token>`
 * subprotocol); it is never anything the client says in a frame.
 */

/** Application close codes. Distinct from the legacy 4001 'revoked' so diagnostics stay readable. */
export const SESSION_CLOSE_UNAUTHENTICATED = 4401
export const SESSION_CLOSE_PROTOCOL_MISMATCH = 4402

/** The two things the gateway needs from a connection; anything socket-shaped satisfies it. */
export type SessionTransport = {
  readonly send: (payload: string) => void
  readonly close: (code: number, reason: string) => void
}

/** Everything a session may send once it is open. A second hello is not one of them. */
const openSessionClientFrameSchema = z.discriminatedUnion('t', [
  sessionWatchesFrameSchema,
  ...terminalClientFrameSchema.options,
])

/**
 * Where accepted terminal frames go. Declared, not wired: `RT-005` implements it over the
 * terminal manager.
 */
export type SessionTerminalBridge = {
  readonly receive: (frame: TerminalClientFrame) => void
  /** The socket closed: detach this session's senders. PTYs are daemon-owned and live on. */
  readonly detach: () => void
}

export type SessionConnection = {
  /** The identity the upgrade authenticated. `null` is an unauthenticated socket. */
  readonly identity: AuthIdentity | null
  readonly transport: SessionTransport
  readonly watchSink: SessionWatchSink
  /** Accepted canonical project scope for transport adapters that publish watcher facts. */
  readonly onProjectScopeChanged: (projectPath: string | undefined) => void
  readonly terminal: SessionTerminalBridge
}

export type OpenSession = {
  readonly identity: AuthIdentity
  /** One raw client frame exactly as it arrived off the wire. */
  readonly receive: (raw: string) => void
  /**
   * Daemon → client PTY traffic. A separate ordered path: terminal frames never enter the
   * change union and never consume a `sequence`, so a chatty shell cannot look like a gap in
   * the change stream and a change cannot reorder PTY output.
   */
  readonly sendTerminalFrame: (frame: TerminalServerFrame) => void
  /** Whether the handshake has completed; watches and terminal traffic need `true`. */
  readonly isOpen: () => boolean
  /** The socket closed, or the daemon closed it: release subscription, watches, terminals. */
  readonly close: () => void
}

export type OpenSessionOutcome =
  | { ok: true; session: OpenSession }
  | { ok: false; error: { code: 'session.unauthenticated' } }

export type SessionGateway = {
  readonly openSession: (connection: SessionConnection) => OpenSessionOutcome
}

export function createSessionGateway({
  publisher,
  protocolVersion,
  epoch,
}: {
  publisher: SessionChangePublisher
  protocolVersion: ProtocolVersion
  epoch: string
}): SessionGateway {
  return {
    openSession({ identity, transport, watchSink, onProjectScopeChanged, terminal }) {
      // Fail closed. The upgrade is the authentication boundary; a connection that arrives
      // without an identity is refused before any per-session resource exists.
      if (identity === null) {
        transport.close(SESSION_CLOSE_UNAUTHENTICATED, 'unauthenticated')
        return { ok: false, error: { code: 'session.unauthenticated' } }
      }

      const watches = createSessionWatchInterests(watchSink)
      let state: 'awaiting-hello' | 'open' | 'closed' = 'awaiting-hello'
      let subscription: ReturnType<SessionChangePublisher['subscribe']> | undefined

      const send = (frame: unknown): void => {
        transport.send(JSON.stringify(frame))
      }

      const close = (): void => {
        if (state === 'closed') return
        state = 'closed'
        subscription?.close()
        subscription = undefined
        watches.clear()
        onProjectScopeChanged(undefined)
        terminal.detach()
      }

      const readJson = (raw: string): unknown => {
        try {
          return JSON.parse(raw)
        } catch {
          // Not JSON at all. During the handshake that is a frame the client cannot have
          // meant as a hello, and the mismatch decision reports it as announcing no version.
          return null
        }
      }

      const handleHello = (frame: unknown): void => {
        const decision = decideSessionHandshake({
          frame,
          daemonProtocolVersion: protocolVersion,
          epoch,
        })
        if (decision.outcome === 'mismatch') {
          send(sessionMismatchFrameSchema.parse(decision.frame))
          transport.close(SESSION_CLOSE_PROTOCOL_MISMATCH, 'protocol.update-required')
          close()
          return
        }
        // Ready is the only thing that opens the session — and only now does the connection
        // get a change subscription, still unscoped until it declares a project.
        send(sessionReadyFrameSchema.parse(decision.frame))
        subscription = publisher.subscribe({ deliver: (changeFrame) => send(changeFrame) })
        state = 'open'
      }

      const handleOpenFrame = (frame: unknown): void => {
        const parsed = openSessionClientFrameSchema.safeParse(frame)
        // The socket is a network boundary even on loopback: anything that does not validate
        // is dropped rather than guessed at.
        if (!parsed.success) return
        if (parsed.data.t === 'session:watches') {
          const outcome = watches.register(parsed.data)
          // Watch interests carry the project this session is looking at, which is also the
          // only project its change stream may cover. An unusable project path leaves the
          // subscription unscoped: it keeps receiving nothing rather than everything.
          if (outcome.ok) {
            subscription?.scopeToProject(outcome.interests.projectPath)
            onProjectScopeChanged(outcome.interests.projectPath)
          } else {
            watches.clear()
            subscription?.scopeToProject(undefined)
            onProjectScopeChanged(undefined)
          }
          return
        }
        terminal.receive(parsed.data)
      }

      return {
        ok: true,
        session: {
          identity,
          receive(raw) {
            if (state === 'closed') return
            const frame = readJson(raw)
            if (state === 'awaiting-hello') handleHello(frame)
            else handleOpenFrame(frame)
          },
          sendTerminalFrame(frame) {
            if (state !== 'open') return
            send(terminalServerFrameSchema.parse(frame))
          },
          isOpen() {
            return state === 'open'
          },
          close,
        },
      }
    },
  }
}
