import { randomUUID } from 'node:crypto'
import { PROTOCOL_VERSION } from '@porcelain/contracts'
import type { SessionChange } from '@porcelain/contracts/session'
import { WebSocket } from 'ws'
import { createSessionFilesWatches } from '../features/files'
import type { AuthIdentity } from '../features/remote'
import {
  createTerminalStreamGateway,
  type TerminalOperations,
  type TerminalStreamSink,
} from '../features/terminal'
import { createSessionChangePublisher, type SessionChangePublisher } from './change-publisher'
import {
  createSessionGateway,
  type OpenSession,
  type SessionTerminalBridge,
} from './session-gateway'

/**
 * Activated session surface: one publisher + gateway for the process, real WebSocket
 * transports, Files watch sinks, and terminal bridges. Replaces legacy `session/live-session`
 * and the `legacy event bus` bus in one switch (RT-005).
 */

const epoch = randomUUID()
const publisher: SessionChangePublisher = createSessionChangePublisher({ epoch })
const gateway = createSessionGateway({
  publisher,
  protocolVersion: PROTOCOL_VERSION,
  epoch,
})

type LiveSession = {
  readonly identity: AuthIdentity
  readonly close: () => void
}

const sessions = new Set<LiveSession>()

/** Publish a domain change fact on the single process-wide publisher. */
export function publishSessionChange(change: SessionChange): void {
  publisher.publish(change)
}

export function createSession(
  socket: WebSocket,
  identity: AuthIdentity,
  terminal: TerminalOperations,
): void {
  let closed = false
  let openSession: OpenSession | undefined

  const terminalSink: TerminalStreamSink = {
    isAlive: () => !closed && socket.readyState === WebSocket.OPEN,
    send: (frame) => openSession?.sendTerminalFrame(frame),
  }
  const terminalGateway = createTerminalStreamGateway({ operations: terminal, sink: terminalSink })

  const terminalBridge: SessionTerminalBridge = {
    receive: terminalGateway.receive,
    detach: terminalGateway.detach,
  }

  const filesWatches = createSessionFilesWatches({
    publish: (change) => publisher.publish(change),
  })

  const outcome = gateway.openSession({
    identity,
    transport: {
      send(payload) {
        if (socket.readyState === WebSocket.OPEN) socket.send(payload)
      },
      close(code, reason) {
        socket.close(code, reason)
      },
    },
    watchSink: {
      apply(interests) {
        filesWatches.apply(interests)
      },
      clear() {
        filesWatches.clear()
      },
    },
    onProjectScopeChanged: () => {},
    terminal: terminalBridge,
  })

  if (!outcome.ok) return

  openSession = outcome.session
  const live: LiveSession = {
    identity,
    close() {
      if (closed) return
      closed = true
      sessions.delete(live)
      outcome.session.close()
      if (socket.readyState === WebSocket.OPEN || socket.readyState === WebSocket.CONNECTING) {
        socket.close(4001, 'revoked')
      }
    },
  }
  sessions.add(live)

  socket.on('message', (raw) => {
    if (closed) return
    outcome.session.receive(raw.toString())
  })
  socket.on('error', () => {})
  socket.on('close', () => {
    if (closed) return
    closed = true
    sessions.delete(live)
    outcome.session.close()
  })
}

export function sessionCount(): number {
  return sessions.size
}

export function clientSessionCount(): number {
  let count = 0
  for (const session of sessions) {
    if (session.identity.kind === 'client') count += 1
  }
  return count
}

export function closeAllSessions(): void {
  for (const session of [...sessions]) session.close()
}

export function closeClientSessions(clientId: string): void {
  for (const session of [...sessions]) {
    if (session.identity.kind === 'client' && session.identity.clientId === clientId) {
      session.close()
    }
  }
}
