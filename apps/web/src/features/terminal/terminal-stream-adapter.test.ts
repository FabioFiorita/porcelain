import { PROTOCOL_VERSION } from '@porcelain/contracts'
import {
  type TerminalClientFrame,
  terminalClientFrameSchema,
  terminalStreamFixtures,
} from '@porcelain/contracts/terminal'
import { createDaemonSession } from '@renderer/lib/daemon'
import type { SessionSocket, SessionSocketHandlers } from '@renderer/lib/session-browser-adapter'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  type BrowserTerminalAdapter,
  type BrowserTerminalAdapterOptions,
  createBrowserTerminalAdapter,
} from './terminal-stream-adapter'

type FakeSocket = SessionSocket & {
  readonly handlers: SessionSocketHandlers
  readonly sent: string[]
  readonly closed: () => boolean
}

type PendingRetry = {
  readonly run: () => void
  readonly delayMs: number
}

type Harness = {
  readonly adapter: BrowserTerminalAdapter
  readonly sockets: FakeSocket[]
  readonly retries: PendingRetry[]
  readonly socket: () => FakeSocket
  readonly connect: (epoch?: string) => void
  readonly deliver: (frame: unknown) => void
}

function harness(options: BrowserTerminalAdapterOptions = {}): Harness {
  const sockets: FakeSocket[] = []
  const retries: PendingRetry[] = []
  const session = createDaemonSession(
    { url: 'http://synthetic-daemon', token: 'synthetic-token' },
    {
      openSocket: ({ handlers }) => {
        let isClosed = false
        const sent: string[] = []
        const socket: FakeSocket = {
          handlers,
          sent,
          closed: () => isClosed,
          send: (payload) => sent.push(payload),
          close: () => {
            isClosed = true
          },
        }
        sockets.push(socket)
        return socket
      },
      schedule: (run, delayMs) => {
        const entry = { run, delayMs }
        retries.push(entry)
        return () => {
          const index = retries.indexOf(entry)
          if (index >= 0) retries.splice(index, 1)
        }
      },
    },
  )
  const adapter = createBrowserTerminalAdapter(session, options)
  const socket = (): FakeSocket => {
    const current = sockets.at(-1)
    if (current === undefined) throw new Error('expected a fake socket')
    return current
  }
  const connect = (epoch = 'epoch-1'): void => {
    socket().handlers.opened()
    deliver({ t: 'session:ready', protocolVersion: PROTOCOL_VERSION, epoch })
  }
  const deliver = (frame: unknown): void => {
    socket().handlers.message(JSON.stringify(frame))
  }
  return { adapter, sockets, retries, socket, connect, deliver }
}

/**
 * Parse what the adapter put on the wire as the contract's own client-frame union.
 *
 * This used to return `{ t: string; [key: string]: unknown }`, so narrowing on `t` gave back a
 * bag of `unknown` and every field read was untyped — the test could assert `reqId` on a frame
 * that has none. Validating against the schema also makes a frame that drifts from the contract
 * fail here rather than at runtime.
 */
function sentFrames(socket: FakeSocket): TerminalClientFrame[] {
  // The socket also carries session frames; keep only what the terminal contract recognises.
  return socket.sent
    .map((payload) => terminalClientFrameSchema.safeParse(JSON.parse(payload)))
    .filter((parsed) => parsed.success)
    .map((parsed) => parsed.data)
}

function attachReply(reqId: string, id = 'term-1', sequence = 0): object {
  return {
    ...terminalStreamFixtures.lifecycle.attached,
    reqId,
    id,
    sequence,
  }
}

beforeEach(() => {
  vi.useFakeTimers()
})

afterEach(() => {
  vi.useRealTimers()
})

describe('Browser Terminal stream adapter', () => {
  it('queues and correlates create, paste, and attach without a found sentinel', async () => {
    const context = harness({
      requestId: (() => {
        let n = 0
        return () => `req-${++n}`
      })(),
    })
    const create = context.adapter.createTerminal({ name: 'zsh', cwd: '/synthetic/repo' })
    const socket = context.socket()
    expect(socket.sent).toEqual([])

    context.connect()
    const createFrame = sentFrames(socket).find((frame) => frame.t === 'terminal:create')
    expect(createFrame).toMatchObject({ t: 'terminal:create', reqId: 'req-1' })
    if (createFrame?.t !== 'terminal:create') throw new Error('expected create frame')
    context.deliver({
      ...terminalStreamFixtures.lifecycle.created,
      reqId: createFrame.reqId,
      id: 'term-1',
    })
    await expect(create).resolves.toBe('term-1')

    context.deliver({
      ...terminalStreamFixtures.output.data,
      id: 'term-1',
      sequence: 0,
    })

    const attach = context.adapter.attachTerminal('term-2')
    const attachFrame = sentFrames(socket).find((frame) => frame.t === 'terminal:attach')
    expect(attachFrame).toMatchObject({ t: 'terminal:attach', id: 'term-2', reqId: 'req-2' })
    if (attachFrame?.t !== 'terminal:attach') throw new Error('expected attach frame')
    context.deliver(attachReply(attachFrame.reqId, 'term-2'))
    await expect(attach).resolves.toMatchObject({ scrollback: '$ pnpm lint\n', status: 'running' })

    const paste = context.adapter.pasteImageToTerminal({
      id: 'term-1',
      mime: 'image/png',
      dataBase64: 'aW1hZ2U=',
    })
    const pasteFrame = sentFrames(socket).find((frame) => frame.t === 'terminal:paste-image')
    expect(pasteFrame).toMatchObject({ t: 'terminal:paste-image', reqId: 'req-3' })
    if (pasteFrame?.t !== 'terminal:paste-image') throw new Error('expected paste frame')
    context.deliver({ ...terminalStreamFixtures.input.imagePasted, reqId: pasteFrame.reqId })
    await expect(paste).resolves.toEqual({ result: 'ok', path: '/synthetic/scratch/pasted.png' })
  })

  it('routes attach scrollback before accepted live data and chunks bounded writes', async () => {
    const context = harness()
    const events: string[] = []
    context.adapter.subscribe({
      onScrollback: () => events.push('scrollback'),
      onData: () => events.push('data'),
    })
    const attach = context.adapter.attachTerminal('term-1')
    context.connect()
    const socket = context.socket()
    const attachFrame = sentFrames(socket).find((frame) => frame.t === 'terminal:attach')
    if (attachFrame?.t !== 'terminal:attach') throw new Error('expected attach frame')
    context.deliver(attachReply(attachFrame.reqId))
    context.deliver({ ...terminalStreamFixtures.output.data, id: 'term-1' })
    await attach
    expect(events).toEqual(['scrollback', 'data'])

    context.adapter.writeTerminal('term-1', 'x'.repeat(65_537))
    const writes = sentFrames(socket).filter((frame) => frame.t === 'terminal:write')
    expect(writes).toHaveLength(2)
    expect(writes[0]?.reqId).not.toBe(writes[1]?.reqId)
    expect((writes[0]?.data as string).length).toBe(65_536)
    expect((writes[1]?.data as string).length).toBe(1)
  })

  it('rejects typed server failures, close failures, and expired requests', async () => {
    const context = harness()
    const attach = context.adapter.attachTerminal('term-gone')
    context.connect()
    const attachFrame = sentFrames(context.socket()).find((frame) => frame.t === 'terminal:attach')
    if (attachFrame?.t !== 'terminal:attach') throw new Error('expected attach frame')
    context.deliver({
      ...terminalStreamFixtures.error,
      reqId: attachFrame.reqId,
      id: 'term-gone',
    })
    await expect(attach).rejects.toMatchObject({
      reason: 'server',
      error: { code: 'terminal.not-found' },
    })

    const create = context.adapter.createTerminal({ name: 'bash', cwd: '/synthetic/repo' })
    context.socket().handlers.closed()
    await expect(create).rejects.toEqual({ reason: 'closed' })

    let now = 0
    const timed = harness({ now: () => now })
    const timeout = timed.adapter.createTerminal({ name: 'fish', cwd: '/synthetic/repo' })
    now = 10_000
    vi.advanceTimersByTime(10_000)
    await expect(timeout).rejects.toEqual({ reason: 'deadline' })
  })

  it('reattaches desired sessions with fresh ids after reconnect and emits recovery', async () => {
    const context = harness()
    const recoveryReasons: string[] = []
    const scrollbacks: string[] = []
    context.adapter.subscribe({
      onRecovery: (recovery) => recoveryReasons.push(recovery.reason),
      onScrollback: (_id, scrollback) => scrollbacks.push(scrollback),
    })
    const initial = context.adapter.attachTerminal('term-1')
    context.connect()
    const firstAttach = sentFrames(context.socket()).find((frame) => frame.t === 'terminal:attach')
    if (firstAttach?.t !== 'terminal:attach') throw new Error('expected initial attach')
    context.deliver(attachReply(firstAttach.reqId))
    await initial

    context.socket().handlers.closed()
    const retry = context.retries.shift()
    if (retry === undefined) throw new Error('expected reconnect timer')
    retry.run()
    context.connect('epoch-2')

    const secondAttach = sentFrames(context.socket()).find((frame) => frame.t === 'terminal:attach')
    if (secondAttach?.t !== 'terminal:attach') throw new Error('expected reconnect attach')
    expect(secondAttach.reqId).not.toBe(firstAttach.reqId)
    expect(context.adapter.isTerminalAttached('term-1')).toBe(true)
    context.deliver(attachReply(secondAttach.reqId, 'term-1'))

    expect(recoveryReasons).toEqual(['reconnect'])
    expect(scrollbacks).toHaveLength(2)
  })

  it('does not replay writes while disconnected and keeps daemon sessions isolated', async () => {
    const left = harness()
    const right = harness()
    const leftAttach = left.adapter.attachTerminal('left')
    left.connect()
    const leftFrame = sentFrames(left.socket()).find((frame) => frame.t === 'terminal:attach')
    if (leftFrame?.t !== 'terminal:attach') throw new Error('expected left attach')
    left.deliver(attachReply(leftFrame.reqId, 'left'))
    await leftAttach
    const before = left.sockets.length
    left.socket().handlers.closed()
    left.adapter.writeTerminal('left', 'not replayed')
    expect(left.sockets).toHaveLength(before)

    const rightAttach = right.adapter.attachTerminal('right')
    right.connect()
    const rightFrame = sentFrames(right.socket()).find((frame) => frame.t === 'terminal:attach')
    if (rightFrame?.t !== 'terminal:attach') throw new Error('expected right attach')
    right.deliver(attachReply(rightFrame.reqId, 'right'))
    await rightAttach
    expect(sentFrames(right.socket()).some((frame) => frame.t === 'terminal:write')).toBe(false)
  })

  it('turns a sequence gap into typed recovery without forwarding stale output', async () => {
    const context = harness()
    const recoveryReasons: string[] = []
    const data: string[] = []
    context.adapter.subscribe({
      onRecovery: (recovery) => recoveryReasons.push(recovery.reason),
      onData: (_id, value) => data.push(value),
    })

    const attach = context.adapter.attachTerminal('term-1')
    context.connect()
    const firstAttach = sentFrames(context.socket()).find((frame) => frame.t === 'terminal:attach')
    if (firstAttach?.t !== 'terminal:attach') throw new Error('expected initial attach')
    context.deliver(attachReply(firstAttach.reqId))
    await attach

    context.deliver({
      ...terminalStreamFixtures.output.data,
      id: 'term-1',
      data: 'stale',
      sequence: 3,
    })

    expect(data).toEqual([])
    expect(recoveryReasons).toEqual(['sequence-gap'])
    const recoveryAttach = sentFrames(context.socket()).find(
      (frame) => frame.t === 'terminal:attach' && frame.reqId !== firstAttach.reqId,
    )
    expect(recoveryAttach).toMatchObject({ t: 'terminal:attach', id: 'term-1' })
  })

  it('keeps desired attachment state idempotent for duplicate attach requests', async () => {
    const context = harness()
    const first = context.adapter.attachTerminal('term-1')
    context.connect()
    const frame = sentFrames(context.socket()).find(
      (candidate) => candidate.t === 'terminal:attach',
    )
    if (frame?.t !== 'terminal:attach') throw new Error('expected initial attach')
    context.deliver(attachReply(frame.reqId))
    await first

    await expect(context.adapter.attachTerminal('term-1')).rejects.toEqual({
      reason: 'not-requestable',
    })
    expect(context.adapter.isTerminalAttached('term-1')).toBe(true)
  })
})
