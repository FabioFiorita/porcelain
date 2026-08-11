import {
  createSessionClientRuntime,
  type TerminalServerFrame,
} from '@porcelain/client-runtime/session/client-runtime'
import type { FreshnessRequirement } from '@porcelain/client-runtime/session/recovery'
import { PROTOCOL_VERSION } from '@porcelain/contracts'
import type { SessionChange, SessionMismatchFrame } from '@porcelain/contracts/session'
import { sessionContractFixtures } from '@porcelain/contracts/session'
import { terminalStreamFixtures } from '@porcelain/contracts/terminal'
import { describe, expect, it } from 'vitest'
import {
  createSessionBrowserAdapter,
  type SessionBrowserAdapter,
  type SessionConnectionStatus,
  type SessionEndpoint,
  type SessionSocket,
  type SessionSocketHandlers,
} from './session-browser-adapter'

/**
 * The adapter is proved against the REAL shared runtime and a fake socket, never a fake runtime:
 * the whole point of `RT-003` is that hello/ready, recovery, and terminal delivery have one
 * implementation, so a double reimplementing them here would prove the double instead.
 */

const PROJECT = '/synthetic/repo'
const ORIGIN = 'http://127.0.0.1:43118'
const TOKEN = 'synthetic-token'

type FakeSocket = SessionSocket & {
  readonly url: string
  readonly protocols: readonly string[]
  readonly handlers: SessionSocketHandlers
  readonly sent: string[]
  readonly closed: () => boolean
}

type Pending = { readonly run: () => void; readonly delayMs: number }

type Harness = {
  readonly adapter: SessionBrowserAdapter
  readonly sockets: FakeSocket[]
  readonly pending: Pending[]
  readonly statuses: SessionConnectionStatus[]
  readonly changes: SessionChange[]
  readonly requirements: FreshnessRequirement[]
  readonly terminal: TerminalServerFrame[]
  readonly mismatches: SessionMismatchFrame[]
  readonly socket: () => FakeSocket
  readonly deliver: (frame: unknown) => void
  readonly runRetry: () => void
}

function harness(endpoint: SessionEndpoint = { url: ORIGIN, token: TOKEN }): Harness {
  const sockets: FakeSocket[] = []
  const pending: Pending[] = []
  const statuses: SessionConnectionStatus[] = []
  const changes: SessionChange[] = []
  const requirements: FreshnessRequirement[] = []
  const terminal: TerminalServerFrame[] = []
  const mismatches: SessionMismatchFrame[] = []

  const runtime = createSessionClientRuntime({
    observer: {
      onChange: (change) => changes.push(change),
      onFreshnessRequired: (requirement) => requirements.push(requirement),
      onTerminalFrame: (frame) => terminal.push(frame),
      onUpdateRequired: (frame) => mismatches.push(frame),
    },
  })
  runtime.selectProject(PROJECT)

  const adapter = createSessionBrowserAdapter({
    runtime,
    endpoint: () => endpoint,
    pageOrigin: () => 'http://page.origin',
    onStatusChange: (status) => statuses.push(status),
    openSocket: ({ url, protocols, handlers }) => {
      const sent: string[] = []
      let isClosed = false
      const socket: FakeSocket = {
        url,
        protocols,
        handlers,
        sent,
        send: (payload) => sent.push(payload),
        close: () => {
          isClosed = true
        },
        closed: () => isClosed,
      }
      sockets.push(socket)
      return socket
    },
    schedule: (run, delayMs) => {
      const entry = { run, delayMs }
      pending.push(entry)
      return () => {
        const index = pending.indexOf(entry)
        if (index >= 0) pending.splice(index, 1)
      }
    },
  })

  const socket = (): FakeSocket => {
    const current = sockets.at(-1)
    if (!current) throw new Error('no socket was opened')
    return current
  }

  return {
    adapter,
    sockets,
    pending,
    statuses,
    changes,
    requirements,
    terminal,
    mismatches,
    socket,
    deliver: (frame) => socket().handlers.message(JSON.stringify(frame)),
    runRetry: () => {
      const next = pending.shift()
      if (!next) throw new Error('no reconnect was scheduled')
      next.run()
    },
  }
}

const readyFrame = { t: 'session:ready', protocolVersion: PROTOCOL_VERSION, epoch: 'epoch-1' }

/** A started adapter whose socket completed the handshake. */
function connected(context = harness()): Harness {
  context.adapter.start()
  context.socket().handlers.opened()
  context.deliver(readyFrame)
  return context
}

describe('Session browser adapter connection', () => {
  it('opens the session socket at the daemon origin carrying the token subprotocol', () => {
    const context = harness()

    context.adapter.start()

    expect(context.socket().url).toBe('ws://127.0.0.1:43118/session')
    expect(context.socket().protocols).toEqual(['porcelain.synthetic-token'])
    expect(context.adapter.status()).toBe('connecting')
  })

  it('falls back to the page origin and sends no subprotocol without a token', () => {
    const context = harness({ url: '', token: '' })

    context.adapter.start()

    expect(context.socket().url).toBe('ws://page.origin/session')
    expect(context.socket().protocols).toEqual([])
  })

  it('hands the open connection to the runtime, which announces this build protocol first', () => {
    const context = harness()

    context.adapter.start()
    context.socket().handlers.opened()

    expect(context.socket().sent.map((raw) => JSON.parse(raw))).toEqual([
      { t: 'session:hello', protocolVersion: PROTOCOL_VERSION },
    ])
    expect(context.adapter.status()).toBe('open')
  })

  it('registers watches after ready and reports the connection open once', () => {
    const context = connected()

    expect(JSON.parse(context.socket().sent[1] ?? 'null')).toEqual({
      t: 'session:watches',
      projectPath: PROJECT,
      files: [],
      dirs: [],
    })
    expect(context.statuses).toEqual(['connecting', 'open'])
  })

  it('starting twice does not open a second socket', () => {
    const context = connected()

    context.adapter.start()

    expect(context.sockets).toHaveLength(1)
  })
})

describe('Session browser adapter recovery', () => {
  it('reconnects with capped backoff and re-handshakes on the new socket', () => {
    const context = connected()

    context.socket().handlers.closed()

    expect(context.adapter.status()).toBe('reconnecting')
    expect(context.pending).toHaveLength(1)

    context.runRetry()
    context.socket().handlers.opened()
    context.deliver({ ...readyFrame, epoch: 'epoch-1' })

    expect(context.sockets).toHaveLength(2)
    expect(JSON.parse(context.socket().sent[0] ?? 'null')).toEqual({
      t: 'session:hello',
      protocolVersion: PROTOCOL_VERSION,
    })
    // The reconnect itself is the recovery point — delivery is best effort and non-durable.
    expect(context.requirements).toEqual([{ reason: 'reconnect', scope: { kind: 'session' } }])
  })

  it('grows the retry delay between attempts and resets it after a connection opens', () => {
    const context = connected()

    context.socket().handlers.closed()
    const first = context.pending[0]?.delayMs ?? 0
    context.runRetry()
    context.socket().handlers.closed()
    const second = context.pending[0]?.delayMs ?? 0

    expect(second).toBeGreaterThan(first)

    context.runRetry()
    context.socket().handlers.opened()
    context.socket().handlers.closed()

    expect(context.pending[0]?.delayMs ?? 0).toBeLessThan(second)
  })

  it('ignores a retired socket that closes after a newer one took over', () => {
    const context = connected()
    const stale = context.socket()

    stale.handlers.closed()
    context.runRetry()
    stale.handlers.closed()
    stale.handlers.message(JSON.stringify(readyFrame))

    expect(context.sockets).toHaveLength(2)
    expect(context.pending).toHaveLength(0)
  })
})

describe('Session browser adapter shutdown', () => {
  it('closes the socket and cancels a pending reconnect on stop', () => {
    const context = connected()

    context.socket().handlers.closed()
    expect(context.pending).toHaveLength(1)
    context.adapter.stop()

    expect(context.pending).toHaveLength(0)
    expect(context.adapter.status()).toBe('idle')

    context.adapter.stop()
    expect(context.sockets).toHaveLength(1)
  })

  it('stops speaking for good once the daemon refuses this build protocol', () => {
    const context = harness()
    context.adapter.start()
    context.socket().handlers.opened()

    context.deliver(sessionContractFixtures.mismatch)
    context.adapter.updateRequired()

    expect(context.mismatches).toEqual([sessionContractFixtures.mismatch])
    expect(context.adapter.status()).toBe('update-required')
    expect(context.socket().closed()).toBe(true)
    // Terminal: a close after the refusal must not schedule another attempt at the same answer.
    context.socket().handlers.closed()
    expect(context.pending).toHaveLength(0)
    expect(context.sockets).toHaveLength(1)
  })
})

describe('Session browser adapter frame delivery', () => {
  it('forwards change and terminal frames to the runtime without interpreting them', () => {
    const context = connected()

    context.deliver({
      t: 'session:change',
      epoch: 'epoch-1',
      sequence: 0,
      change: { kind: 'board.changed', projectPath: PROJECT },
    })
    context.deliver(terminalStreamFixtures.output.data)

    expect(context.changes).toEqual([{ kind: 'board.changed', projectPath: PROJECT }])
    expect(context.terminal.map((frame) => frame.t)).toEqual(['terminal:data'])
    expect(context.requirements).toEqual([])
  })
})
