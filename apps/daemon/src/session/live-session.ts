import { randomUUID } from 'node:crypto'
import { PROTOCOL_VERSION } from '@porcelain/contracts'
import type { SessionChange } from '@porcelain/contracts/session'
import { WebSocket } from 'ws'
import {
  clearWatchedDirs,
  clearWatchedFiles,
  setWatchedDirs,
  setWatchedFiles,
} from '../fs/file-watch'
import type { AuthIdentity } from '../stores/access-store'
import { pasteFileToTerminal, pasteImageToTerminal } from '../terminal/image-paste'
import {
  attachTerminal,
  createTerminal,
  detachSender,
  detachTerminal,
  killTerminal,
  resizeTerminal,
  type TerminalSender,
  writeTerminal,
} from '../terminal/terminal-manager'
import { createSessionChangePublisher, type SessionChangePublisher } from './change-publisher'
import {
  createSessionGateway,
  type OpenSession,
  type SessionTerminalBridge,
  type TerminalClientFrame,
  type TerminalServerFrame,
} from './session-gateway'

/**
 * Activated session surface: one publisher + gateway for the process, real WebSocket
 * transports, file-watch sinks, and terminal bridges. Replaces legacy `session/live-session`
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

export function createSession(socket: WebSocket, identity: AuthIdentity): void {
  let closed = false
  let projectPath: string | undefined
  let openSession: OpenSession | undefined

  const sendTerminal = (frame: TerminalServerFrame): void => {
    openSession?.sendTerminalFrame(frame)
  }

  const terminalSender: TerminalSender = {
    isDestroyed: () => closed || socket.readyState !== WebSocket.OPEN,
    send(channel, ...args: unknown[]) {
      if (channel === 'terminal:data') {
        const [id, data] = args as [string, string]
        sendTerminal({ t: 'terminal:data', id, data })
        return
      }
      if (channel === 'terminal:exit') {
        const [id, exitCode] = args as [string, number]
        sendTerminal({ t: 'terminal:exit', id, exitCode })
      }
    },
  }

  const terminalBridge: SessionTerminalBridge = {
    receive(frame) {
      handleTerminalFrame(frame, terminalSender, sendTerminal)
    },
    detach() {
      detachSender(terminalSender)
    },
  }

  const fileWatchSender = {
    isDestroyed: () => closed || socket.readyState !== WebSocket.OPEN,
    send(_channel: string, event: unknown) {
      if (projectPath === undefined) return
      if (event === 'working-tree') {
        publisher.publish({
          kind: 'files.content-changed',
          projectPath,
          paths: [projectPath],
        })
        return
      }
      if (event === 'file-tree') {
        publisher.publish({
          kind: 'files.tree-changed',
          projectPath,
          paths: [projectPath],
        })
      }
    },
  }

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
      setWatchedFiles(paths) {
        setWatchedFiles(fileWatchSender, [...paths])
      },
      setWatchedDirs(paths) {
        setWatchedDirs(fileWatchSender, [...paths])
      },
      clear() {
        clearWatchedFiles(fileWatchSender)
        clearWatchedDirs(fileWatchSender)
      },
    },
    onProjectScopeChanged(nextProjectPath) {
      projectPath = nextProjectPath
    },
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

function handleTerminalFrame(
  frame: TerminalClientFrame,
  sender: TerminalSender,
  sendTerminal: (frame: TerminalServerFrame) => void,
): void {
  switch (frame.t) {
    case 'terminal:create': {
      let id: string
      try {
        id = createTerminal(sender, {
          name: frame.name,
          cwd: frame.cwd,
          initialInput: frame.initialInput,
          cols: frame.cols,
          rows: frame.rows,
        })
      } catch (error) {
        console.error('[daemon] terminal:create refused:', error)
        id = ''
      }
      sendTerminal({ t: 'terminal:created', reqId: frame.reqId, id })
      break
    }
    case 'terminal:attach': {
      const result = attachTerminal(frame.id, sender)
      sendTerminal({
        t: 'terminal:attached',
        reqId: frame.reqId,
        id: frame.id,
        scrollback: result?.scrollback ?? '',
        status: result?.status ?? 'exited',
        exitCode: result?.exitCode,
        found: result !== null,
      })
      break
    }
    case 'terminal:detach':
      detachTerminal(frame.id, sender)
      break
    case 'terminal:write':
      writeTerminal(frame.id, frame.data)
      break
    case 'terminal:resize':
      resizeTerminal(frame.id, frame.cols, frame.rows)
      break
    case 'terminal:kill':
      killTerminal(frame.id)
      break
    case 'terminal:paste-image': {
      const { id, reqId } = frame
      pasteImageToTerminal(frame)
        .then((outcome) => {
          sendTerminal({ t: 'terminal:image-pasted', reqId, id, ...outcome })
        })
        .catch(() => {
          sendTerminal({ t: 'terminal:image-pasted', reqId, id, result: 'write-failed' })
        })
      break
    }
    case 'terminal:paste-file': {
      const { id, reqId } = frame
      pasteFileToTerminal(frame)
        .then((outcome) => {
          sendTerminal({ t: 'terminal:file-pasted', reqId, id, ...outcome })
        })
        .catch(() => {
          sendTerminal({ t: 'terminal:file-pasted', reqId, id, result: 'write-failed' })
        })
      break
    }
  }
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
