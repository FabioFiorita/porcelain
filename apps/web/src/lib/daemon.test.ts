import { PROTOCOL_VERSION } from '@porcelain/contracts'
import { sessionReadyFrameSchema } from '@porcelain/contracts/session'
import { terminalStreamFixtures } from '@porcelain/contracts/terminal'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

/**
 * The Web daemon module owns one socket and the generic session lifecycle. Terminal semantics
 * belong to the feature adapter; these tests only prove the public raw-frame and ready seams.
 */

class FakeWebSocket {
  static instances: FakeWebSocket[] = []
  static CONNECTING = 0
  static OPEN = 1
  static CLOSING = 2
  static CLOSED = 3
  readyState = FakeWebSocket.CONNECTING
  sent: string[] = []
  onopen: (() => void) | null = null
  onmessage: ((event: { data: unknown }) => void) | null = null
  onclose: (() => void) | null = null

  constructor(
    public url: string,
    public protocols: string[],
  ) {
    FakeWebSocket.instances.push(this)
  }

  send(data: string): void {
    this.sent.push(data)
  }

  close(): void {
    this.readyState = FakeWebSocket.CLOSED
    this.onclose?.()
  }

  open(): void {
    this.readyState = FakeWebSocket.OPEN
    this.onopen?.()
  }

  receive(message: unknown): void {
    this.onmessage?.({ data: JSON.stringify(message) })
  }

  receiveRaw(data: unknown): void {
    this.onmessage?.({ data })
  }

  drop(): void {
    this.readyState = FakeWebSocket.CLOSED
    this.onclose?.()
  }
}

const latest = (): FakeWebSocket => {
  const socket = FakeWebSocket.instances.at(-1)
  if (socket === undefined) throw new Error('expected a fake WebSocket')
  return socket
}

function deliverReady(socket: FakeWebSocket, epoch = 'epoch-1'): void {
  const frame = { t: 'session:ready', protocolVersion: PROTOCOL_VERSION, epoch }
  expect(sessionReadyFrameSchema.safeParse(frame).success).toBe(true)
  socket.receive(frame)
}

let daemon: typeof import('./daemon')

beforeEach(async () => {
  vi.useFakeTimers()
  vi.spyOn(Math, 'random').mockReturnValue(0)
  FakeWebSocket.instances = []
  localStorage.clear()
  vi.stubGlobal('WebSocket', FakeWebSocket)
  vi.resetModules()
  daemon = await import('./daemon')
})

afterEach(() => {
  vi.unstubAllGlobals()
  vi.useRealTimers()
  vi.restoreAllMocks()
})

describe('daemon session transport seam', () => {
  it('opens one tokenless socket lazily for a raw Terminal-frame subscriber', () => {
    const listener = vi.fn()

    daemon.onTerminalFrame(listener)

    expect(FakeWebSocket.instances).toHaveLength(1)
    expect(latest().protocols).toEqual([])
    expect(latest().url).toMatch(/^ws.*\/session$/)
  })

  it('forwards complete validated Terminal frames without interpreting them', () => {
    const listener = vi.fn()
    daemon.onTerminalFrame(listener)
    const socket = latest()
    socket.open()
    deliverReady(socket)

    socket.receive(terminalStreamFixtures.lifecycle.attached)
    socket.receive(terminalStreamFixtures.error)

    expect(listener.mock.calls.map(([frame]) => frame)).toEqual([
      terminalStreamFixtures.lifecycle.attached,
      terminalStreamFixtures.error,
    ])
  })

  it('drops malformed inbound frames while keeping the socket alive', () => {
    const listener = vi.fn()
    daemon.onTerminalFrame(listener)
    const socket = latest()
    socket.open()
    deliverReady(socket)

    socket.receiveRaw('not json')
    socket.receive({ t: 'nonsense' })
    socket.receiveRaw(42)
    socket.receive(terminalStreamFixtures.lifecycle.attached)

    expect(listener).toHaveBeenCalledTimes(1)
    expect(listener).toHaveBeenCalledWith(terminalStreamFixtures.lifecycle.attached)
  })

  it('fires ready before reconnect on every successful handshake', () => {
    const events: string[] = []
    daemon.onDaemonReady(() => events.push('ready'))
    daemon.onDaemonReconnect(() => events.push('reconnect'))

    const first = latest()
    first.open()
    deliverReady(first)
    expect(events).toEqual(['ready'])

    first.drop()
    vi.advanceTimersByTime(500)
    const second = latest()
    second.open()
    deliverReady(second, 'epoch-2')

    expect(events).toEqual(['ready', 'ready', 'reconnect'])
  })

  it('notifies generic close listeners and schedules a reconnect', () => {
    const close = vi.fn()
    daemon.onDaemonClose(close)
    const socket = latest()
    socket.open()
    deliverReady(socket)

    socket.drop()

    expect(close).toHaveBeenCalledTimes(1)
    expect(FakeWebSocket.instances).toHaveLength(1)
    vi.advanceTimersByTime(500)
    expect(FakeWebSocket.instances).toHaveLength(2)
  })
})
