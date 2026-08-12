import {
  createSessionClientRuntime,
  type SessionClientRuntime,
} from '@porcelain/client-runtime/session/client-runtime'
import { PROTOCOL_VERSION } from '@porcelain/contracts'
import {
  type TerminalClientFrame,
  type TerminalServerFrame,
  terminalClientFrameSchema,
  terminalStreamFixtures,
} from '@porcelain/contracts/terminal'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import type { DaemonSession } from '@/lib/daemon/session'
import type { SessionConnectionStatus } from '@/lib/daemon/session-native-adapter'

import {
  createMobileTerminalAdapter,
  type MobileTerminalAdapter,
  type MobileTerminalAdapterOptions,
} from './terminal-stream-adapter'

vi.mock('expo-crypto', () => ({
  randomUUID: (() => {
    let next = 0
    return (): string => `synthetic-request-${++next}`
  })(),
}))

type Harness = {
  readonly adapter: MobileTerminalAdapter
  readonly runtime: SessionClientRuntime
  readonly sent: TerminalClientFrame[]
  readonly open: (epoch?: string, reconnect?: boolean) => void
  readonly close: () => void
  readonly reconnect: () => void
  readonly deliver: (frame: TerminalServerFrame) => void
}

function harness(options: MobileTerminalAdapterOptions = {}): Harness {
  const sent: TerminalClientFrame[] = []
  const frameListeners = new Set<(frame: TerminalServerFrame) => void>()
  const readyListeners = new Set<() => void>()
  const reconnectListeners = new Set<() => void>()
  const closeListeners = new Set<() => void>()
  let status: SessionConnectionStatus = 'idle'
  let everOpened = false

  const runtime = createSessionClientRuntime({
    observer: {
      onChange: () => undefined,
      onFreshnessRequired: () => undefined,
      onTerminalFrame: (frame) => {
        for (const listener of frameListeners) listener(frame)
      },
      onUpdateRequired: () => undefined,
    },
  })

  const transport = {
    send(payload: string): void {
      const parsed = terminalClientFrameSchema.safeParse(JSON.parse(payload))
      if (parsed.success) sent.push(parsed.data)
    },
  }

  const session: DaemonSession = {
    runtime,
    get status() {
      return status
    },
    start: () => undefined,
    onTerminalFrame(listener) {
      frameListeners.add(listener)
      return () => frameListeners.delete(listener)
    },
    onDaemonReady(handler) {
      readyListeners.add(handler)
      return () => readyListeners.delete(handler)
    },
    onDaemonReconnect(handler) {
      reconnectListeners.add(handler)
      return () => reconnectListeners.delete(handler)
    },
    onDaemonClose(handler) {
      closeListeners.add(handler)
      return () => closeListeners.delete(handler)
    },
    registerWatchInterest: () => () => undefined,
    selectProject: () => undefined,
    health: () => 'idle',
  }

  const open = (epoch = 'epoch-1', reconnect = false): void => {
    status = 'open'
    runtime.connected(transport)
    runtime.receive(
      JSON.stringify({ t: 'session:ready', protocolVersion: PROTOCOL_VERSION, epoch }),
    )
    for (const handler of [...readyListeners]) handler()
    if (reconnect || everOpened) {
      for (const handler of [...reconnectListeners]) handler()
    }
    everOpened = true
  }

  const close = (): void => {
    status = 'idle'
    runtime.disconnected()
    for (const handler of [...closeListeners]) handler()
  }

  const deliver = (frame: TerminalServerFrame): void => {
    for (const listener of [...frameListeners]) listener(frame)
  }

  const adapter = createMobileTerminalAdapter(session, options)
  return {
    adapter,
    close,
    deliver,
    open,
    reconnect: () => {
      close()
      open('epoch-2', true)
    },
    runtime,
    sent,
  }
}

function frames(harnessValue: Harness, type: TerminalClientFrame['t']): TerminalClientFrame[] {
  return harnessValue.sent.filter((frame) => frame.t === type)
}

function attachReply(reqId: string, id = 'term-1', sequence = 0): TerminalServerFrame {
  return {
    ...terminalStreamFixtures.lifecycle.attached,
    id,
    reqId,
    sequence,
  }
}

beforeEach(() => {
  vi.useFakeTimers()
})

afterEach(() => {
  vi.useRealTimers()
})

describe('Mobile Terminal stream adapter', () => {
  it('queues and correlates create, attach, and paste through the public session seam', async () => {
    const context = harness({
      requestId: (() => {
        let next = 0
        return () => `req-${++next}`
      })(),
    })
    const create = context.adapter.createTerminal({ cwd: '/synthetic/repo', name: 'zsh' })

    expect(context.sent).toEqual([])
    context.open()
    expect(frames(context, 'terminal:create')).toHaveLength(1)
    const createFrame = frames(context, 'terminal:create')[0]
    if (createFrame?.t !== 'terminal:create') throw new Error('expected create frame')
    context.deliver({ ...terminalStreamFixtures.lifecycle.created, reqId: createFrame.reqId })
    await expect(create).resolves.toBe('term-1')

    context.deliver(terminalStreamFixtures.output.data)
    const attach = context.adapter.attachTerminal('term-2')
    const attachFrame = frames(context, 'terminal:attach').at(-1)
    if (attachFrame?.t !== 'terminal:attach') throw new Error('expected attach frame')
    context.deliver(attachReply(attachFrame.reqId, 'term-2'))
    await expect(attach).resolves.toMatchObject({ status: 'running' })

    const paste = context.adapter.pasteImageToTerminal({
      dataBase64: 'aW1hZ2U=',
      id: 'term-1',
      mime: 'image/png',
    })
    const pasteFrame = frames(context, 'terminal:paste-image').at(-1)
    if (pasteFrame?.t !== 'terminal:paste-image') throw new Error('expected paste frame')
    context.deliver({ ...terminalStreamFixtures.input.imagePasted, reqId: pasteFrame.reqId })
    await expect(paste).resolves.toEqual({
      path: '/synthetic/scratch/pasted.png',
      result: 'ok',
    })
  })

  it('routes scrollback before accepted data and chunks bounded writes with fresh ids', async () => {
    const context = harness()
    const events: string[] = []
    context.adapter.subscribe({
      onData: () => events.push('data'),
      onScrollback: () => events.push('scrollback'),
    })

    const attach = context.adapter.attachTerminal('term-1')
    context.open()
    const attachFrame = frames(context, 'terminal:attach')[0]
    if (attachFrame?.t !== 'terminal:attach') throw new Error('expected attach frame')
    context.deliver(attachReply(attachFrame.reqId))
    context.deliver(terminalStreamFixtures.output.data)
    await attach
    expect(events).toEqual(['scrollback', 'data'])

    context.adapter.writeTerminal('term-1', 'x'.repeat(65_537))
    const writes = frames(context, 'terminal:write')
    expect(writes).toHaveLength(2)
    expect(writes[0]?.reqId).not.toBe(writes[1]?.reqId)
    expect(writes[0]?.t === 'terminal:write' ? writes[0].data.length : 0).toBe(65_536)
    expect(writes[1]?.t === 'terminal:write' ? writes[1].data.length : 0).toBe(1)
  })

  it('rejects typed server failures, close failures, and expired requests', async () => {
    const context = harness()
    context.open()
    const missing = context.adapter.attachTerminal('term-gone')
    const missingFrame = frames(context, 'terminal:attach')[0]
    if (missingFrame?.t !== 'terminal:attach') throw new Error('expected attach frame')
    context.deliver({ ...terminalStreamFixtures.error, reqId: missingFrame.reqId })
    await expect(missing).rejects.toMatchObject({
      error: { code: 'terminal.not-found' },
      reason: 'server',
    })

    const closed = context.adapter.createTerminal({ cwd: '/synthetic/repo', name: 'bash' })
    context.close()
    await expect(closed).rejects.toEqual({ reason: 'closed' })

    let now = 0
    const timed = harness({ now: () => now })
    const timeout = timed.adapter.createTerminal({ cwd: '/synthetic/repo', name: 'fish' })
    now = 10_000
    vi.advanceTimersByTime(10_000)
    await expect(timeout).rejects.toEqual({ reason: 'deadline' })
  })

  it('rejects stale requests and never replays fire-and-forget writes', async () => {
    const context = harness()
    const initial = context.adapter.attachTerminal('term-1')
    context.open()
    const first = frames(context, 'terminal:attach')[0]
    if (first?.t !== 'terminal:attach') throw new Error('expected initial attach')
    context.deliver(attachReply(first.reqId))
    await initial

    const create = context.adapter.createTerminal({ cwd: '/synthetic/repo', name: 'bash' })
    const createFrame = frames(context, 'terminal:create')[0]
    if (createFrame?.t !== 'terminal:create') throw new Error('expected create frame')
    context.close()
    await expect(create).rejects.toEqual({ reason: 'closed' })

    context.deliver({ ...terminalStreamFixtures.lifecycle.created, reqId: createFrame.reqId })
    context.adapter.writeTerminal('term-1', 'not replayed')
    expect(frames(context, 'terminal:write')).toHaveLength(0)

    context.open('epoch-2', true)
    expect(frames(context, 'terminal:write')).toHaveLength(0)
    expect(frames(context, 'terminal:attach')).toHaveLength(2)
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
    context.open()
    const first = frames(context, 'terminal:attach')[0]
    if (first?.t !== 'terminal:attach') throw new Error('expected initial attach')
    context.deliver(attachReply(first.reqId))
    await initial

    context.reconnect()
    const recoveryAttach = frames(context, 'terminal:attach').at(-1)
    if (recoveryAttach?.t !== 'terminal:attach') throw new Error('expected recovery attach')
    expect(recoveryAttach.reqId).not.toBe(first.reqId)
    context.deliver(attachReply(recoveryAttach.reqId))

    expect(recoveryReasons).toEqual(['reconnect'])
    expect(scrollbacks).toHaveLength(2)
  })

  it('turns a sequence gap into recovery and never forwards stale output', async () => {
    const context = harness()
    const recoveryReasons: string[] = []
    const data: string[] = []
    context.adapter.subscribe({
      onData: (_id, value) => data.push(value),
      onRecovery: (recovery) => recoveryReasons.push(recovery.reason),
    })

    const attach = context.adapter.attachTerminal('term-1')
    context.open()
    const attachFrame = frames(context, 'terminal:attach')[0]
    if (attachFrame?.t !== 'terminal:attach') throw new Error('expected attach frame')
    context.deliver(attachReply(attachFrame.reqId))
    await attach

    context.deliver({ ...terminalStreamFixtures.output.data, data: 'stale', sequence: 3 })

    expect(data).toEqual([])
    expect(recoveryReasons).toEqual(['sequence-gap'])
    expect(frames(context, 'terminal:attach')).toHaveLength(2)
  })

  it('keeps desired attachment state idempotent for duplicate attach requests', async () => {
    const context = harness()
    const first = context.adapter.attachTerminal('term-1')
    context.open()
    const frame = frames(context, 'terminal:attach')[0]
    if (frame?.t !== 'terminal:attach') throw new Error('expected attach frame')
    context.deliver(attachReply(frame.reqId))
    await first

    await expect(context.adapter.attachTerminal('term-1')).rejects.toEqual({
      reason: 'not-requestable',
    })
    expect(context.adapter.isTerminalAttached('term-1')).toBe(true)
  })
})
