import { PROTOCOL_VERSION } from '@porcelain/contracts'
import { sessionHelloFrameSchema } from '@porcelain/contracts/session'
import {
  MAX_TERMINAL_WRITE_CODE_UNITS,
  terminalInputFrameSchema,
  terminalLifecycleFrameSchema,
} from '@porcelain/contracts/terminal'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

/**
 * Characterization tests for the renderer's ONE WebSocket client
 * (`@renderer/lib/daemon`): outbox queuing after hello/ready, pending create/attach
 * rejection on close, capped-backoff reconnect, re-attach replay, and the
 * first-connect guard. These pin behavior as shipped — they are a tripwire for
 * the next change to reconnect semantics, not a spec to satisfy.
 *
 * The module is a module-scope singleton with no injection seam on `primary`, so
 * each test gets fresh state via `vi.resetModules()` + a dynamic import, and drives
 * a controllable fake `WebSocket` installed with `vi.stubGlobal`. Math.random is
 * pinned so the adapter's jittered backoff is deterministic.
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
  onmessage: ((e: { data: unknown }) => void) | null = null
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
  // test helpers
  open(): void {
    this.readyState = FakeWebSocket.OPEN
    this.onopen?.()
  }
  receive(msg: unknown): void {
    this.onmessage?.({ data: JSON.stringify(msg) })
  }
  drop(): void {
    this.readyState = FakeWebSocket.CLOSED
    this.onclose?.()
  }
}

type ClientFrame = { t: string; [key: string]: unknown }

/** Parsed client frames a socket has sent so far. */
function sentMessages(ws: FakeWebSocket): ClientFrame[] {
  return ws.sent.map((s) => JSON.parse(s) as ClientFrame)
}

/** Validate every outbound frame is a known client-bound schema. */
function assertValidClientFrame(raw: string): void {
  const frame: unknown = JSON.parse(raw)
  if (sessionHelloFrameSchema.safeParse(frame).success) return
  if (terminalLifecycleFrameSchema.safeParse(frame).success) return
  if (terminalInputFrameSchema.safeParse(frame).success) return
  // session:watches is project-scoped; primary tests may not select a project
  if (
    typeof frame === 'object' &&
    frame !== null &&
    't' in frame &&
    (frame as { t: string }).t === 'session:watches'
  ) {
    return
  }
  throw new Error(`unexpected client frame: ${raw}`)
}

function deliverReady(ws: FakeWebSocket, epoch = 'epoch-1'): void {
  ws.receive({ t: 'session:ready', protocolVersion: PROTOCOL_VERSION, epoch })
}

const latest = (): FakeWebSocket => {
  const ws = FakeWebSocket.instances[FakeWebSocket.instances.length - 1]
  if (!ws) throw new Error('expected a FakeWebSocket instance')
  return ws
}

let daemon: typeof import('@renderer/lib/daemon')

beforeEach(async () => {
  vi.useFakeTimers()
  // Adapter backoff multiplies by (1 + random*0.3); pin jitter at 0 for exact delays.
  vi.spyOn(Math, 'random').mockReturnValue(0)
  FakeWebSocket.instances = []
  localStorage.clear()
  vi.stubGlobal('WebSocket', FakeWebSocket)
  vi.resetModules()
  daemon = await import('@renderer/lib/daemon')
})

afterEach(() => {
  for (const ws of FakeWebSocket.instances) {
    for (const frame of ws.sent) {
      assertValidClientFrame(frame)
    }
  }
  vi.unstubAllGlobals()
  vi.useRealTimers()
  vi.restoreAllMocks()
})

describe('daemon session client', () => {
  it('opens one tokenless socket lazily (protocols [] under jsdom)', () => {
    daemon.onDaemonReconnect(() => {})
    expect(FakeWebSocket.instances).toHaveLength(1)
    expect(latest().protocols).toEqual([])
    expect(latest().url).toMatch(/^ws.*\/session$/)
  })

  // --- outbox + settlement ---

  it('queues a create while handshaking, flushes on ready, resolves on reply', async () => {
    const created = daemon.createTerminal({ name: 't', cwd: '/x' })
    const ws = latest()
    expect(ws.sent).toEqual([]) // nothing sent while CONNECTING

    ws.open()
    expect(sentMessages(ws).map((f) => f.t)).toEqual(['session:hello'])
    expect(sentMessages(ws).find((f) => f.t === 'terminal:create')).toBeUndefined()

    deliverReady(ws)
    const frames = sentMessages(ws)
    const create = frames.find((f) => f.t === 'terminal:create')
    expect(create).toBeDefined()
    if (create?.t !== 'terminal:create') throw new Error('unreachable')

    ws.receive({ t: 'terminal:created', reqId: create.reqId, id: 'abc' })
    await expect(created).resolves.toBe('abc')
    expect(daemon.isTerminalAttached('abc')).toBe(true)
  })

  it('rejects pending creates AND attaches on close, empties the outbox, drops the attach id', async () => {
    const created = daemon.createTerminal({ name: 't', cwd: '/x' })
    const attached = daemon.attachTerminal('t1')
    const ws = latest()
    expect(ws.sent).toEqual([]) // both queued, none sent

    const createRejects = expect(created).rejects.toThrow(/daemon connection dropped/)
    const attachRejects = expect(attached).rejects.toThrow(/daemon connection dropped/)
    ws.drop()
    await createRejects
    await attachRejects

    expect(daemon.isTerminalAttached('t1')).toBe(false)
    // Reopening flushes nothing — the outbox was emptied by the close.
    const next = latest() // same dropped instance; reconnect not yet scheduled to fire
    expect(next.sent).toEqual([])
  })

  it('does not queue fire-and-forget messages (write/kill) issued while handshaking', () => {
    daemon.onDaemonReconnect(() => {}) // opens a CONNECTING socket without pushing
    const ws = latest()
    daemon.writeTerminal('id', 'x')
    daemon.killTerminal('id')
    expect(ws.sent).toEqual([]) // dropped, not queued

    ws.open()
    deliverReady(ws)
    const kinds = sentMessages(ws).map((f) => f.t)
    expect(kinds).not.toContain('terminal:write')
    expect(kinds).not.toContain('terminal:kill')
    // Only the protocol hello (and no outbox) landed.
    expect(kinds).toEqual(['session:hello'])
  })

  it('chunks ordinary terminal writes at the shared bounded-frame limit', () => {
    daemon.onDaemonReconnect(() => {})
    const ws = latest()
    ws.open()
    deliverReady(ws)

    daemon.writeTerminal('id', 'x'.repeat(MAX_TERMINAL_WRITE_CODE_UNITS + 1))

    const writes = sentMessages(ws).filter((frame) => frame.t === 'terminal:write')
    expect(writes).toHaveLength(2)
    expect(writes).toEqual([
      expect.objectContaining({ data: 'x'.repeat(MAX_TERMINAL_WRITE_CODE_UNITS) }),
      expect.objectContaining({ data: 'x' }),
    ])
  })

  it('ignores invalid inbound frames; the socket survives to settle a later valid reply', async () => {
    const created = daemon.createTerminal({ name: 't', cwd: '/x' })
    const ws = latest()
    ws.open()
    deliverReady(ws)
    const create = sentMessages(ws).find((f) => f.t === 'terminal:create')
    if (create?.t !== 'terminal:create') throw new Error('expected a create frame')

    ws.onmessage?.({ data: 'not json' }) // JSON.parse failure → ignored
    ws.receive({ t: 'nonsense' }) // schema failure → ignored
    ws.onmessage?.({ data: 42 }) // non-string data → ignored

    ws.receive({ t: 'terminal:created', reqId: create.reqId, id: 'survived' })
    await expect(created).resolves.toBe('survived')
  })

  // --- reconnect ---

  it('reconnects with a new socket after backoff', () => {
    daemon.onDaemonReconnect(() => {})
    const ws = latest()
    ws.open()
    deliverReady(ws)
    ws.drop()
    expect(FakeWebSocket.instances).toHaveLength(1) // no immediate reconnect

    vi.advanceTimersByTime(500)
    expect(FakeWebSocket.instances).toHaveLength(2)
  })

  it('re-attaches on REconnect, but not on the first ready', async () => {
    const attached = daemon.attachTerminal('t1')
    const ws1 = latest()

    ws1.open()
    deliverReady(ws1)
    // First ready: exactly the queued attach — NOT a duplicate re-attach replay.
    const firstAttaches = sentMessages(ws1).filter((f) => f.t === 'terminal:attach')
    expect(firstAttaches).toHaveLength(1)
    const attach = firstAttaches[0]
    if (attach === undefined || attach.t !== 'terminal:attach') throw new Error('unreachable')

    ws1.receive({
      t: 'terminal:attached',
      reqId: attach.reqId,
      id: 't1',
      scrollback: '',
      status: 'running',
      found: true,
    })
    // settle the initial attach so it does not leak across the reconnect
    await attached
    ws1.drop()
    vi.advanceTimersByTime(500)
    const ws2 = latest()
    expect(ws2).not.toBe(ws1)
    ws2.open()
    deliverReady(ws2, 'epoch-2')

    const frames = sentMessages(ws2)
    expect(frames.some((f) => f.t === 'session:hello')).toBe(true)
    expect(frames.some((f) => f.t === 'terminal:attach')).toBe(true)
  })

  it('fires reconnect listeners only on REconnect, never on the first ready', () => {
    const spy = vi.fn()
    daemon.onDaemonReconnect(spy)
    const ws1 = latest()
    ws1.open()
    deliverReady(ws1)
    expect(spy).not.toHaveBeenCalled() // first connect: no refetch

    ws1.drop()
    vi.advanceTimersByTime(500)
    const ws2 = latest()
    ws2.open()
    deliverReady(ws2, 'epoch-2')
    expect(spy).toHaveBeenCalledTimes(1)
  })

  it('fires the close listener so a bound environment can resolve a fallback route', () => {
    const spy = vi.fn()
    daemon.onDaemonClose(spy)
    const ws = latest()
    ws.open()
    deliverReady(ws)
    ws.drop()
    expect(spy).toHaveBeenCalledTimes(1)
  })

  it('caps the reconnect backoff at 10_000ms', () => {
    daemon.onDaemonReconnect(() => {})
    latest().open() // resets backoff to 500
    deliverReady(latest())

    // Drive the backoff up to its cap: drop each socket and let its (ever-larger)
    // timer fire. After ~6 cycles retryDelay is pinned at 10_000.
    for (let i = 0; i < 7; i++) {
      latest().drop()
      vi.advanceTimersByTime(10_000)
    }
    const beforeProbe = FakeWebSocket.instances.length

    // The pinned delay is 10_000: 9_999 is not enough, one more ms fires it.
    latest().drop()
    vi.advanceTimersByTime(9_999)
    expect(FakeWebSocket.instances).toHaveLength(beforeProbe)
    vi.advanceTimersByTime(1)
    expect(FakeWebSocket.instances).toHaveLength(beforeProbe + 1)
  })

  it('setBrowserDaemonToken reconnects with the new subprotocol and refetches even on first ready', () => {
    const spy = vi.fn()
    daemon.onDaemonReconnect(spy) // opens ws0 (CONNECTING)

    daemon.setBrowserDaemonToken('tok') // closes ws0, reconnects immediately
    const ws = latest()
    expect(ws.protocols).toEqual(['porcelain.tok'])
    expect(localStorage.getItem('porcelain-client-token')).toBe('tok')

    ws.open()
    deliverReady(ws)
    // recoveryPending makes this first successful ready fire the refetch listeners.
    expect(spy).toHaveBeenCalledTimes(1)
    expect(daemon.daemonToken()).toBe('tok')
  })

  it('drops the attach id on a failed initial attach so a later attach retries', async () => {
    const attached = daemon.attachTerminal('t2')
    const ws1 = latest()
    const rejects = expect(attached).rejects.toThrow(/daemon connection dropped/)
    ws1.drop()
    await rejects
    expect(daemon.isTerminalAttached('t2')).toBe(false)

    vi.advanceTimersByTime(500) // reconnect creates ws2 (CONNECTING)
    const retry = daemon.attachTerminal('t2')
    const ws2 = latest()
    expect(ws2).not.toBe(ws1)
    ws2.open()
    deliverReady(ws2) // flushes the freshly-queued attach

    expect(daemon.isTerminalAttached('t2')).toBe(true)
    const attaches = sentMessages(ws2).filter((f) => f.t === 'terminal:attach')
    expect(attaches).toHaveLength(1)
    const attach = attaches[0]
    if (attach === undefined || attach.t !== 'terminal:attach') throw new Error('unreachable')
    expect(attach.id).toBe('t2')

    // settle it so the pending attach doesn't leak past the test
    ws2.receive({
      t: 'terminal:attached',
      reqId: attach.reqId,
      id: 't2',
      scrollback: '',
      status: 'running',
      found: true,
    })
    await expect(retry).resolves.toMatchObject({ found: true })
  })

  // --- paste-image ---

  it('sends a paste-image request and resolves with the daemon reply', async () => {
    const pasted = daemon.pasteImageToTerminal('t1', 'image/png', 'YWJj')
    const ws = latest()
    ws.open()
    deliverReady(ws)

    const frame = sentMessages(ws).find((f) => f.t === 'terminal:paste-image')
    expect(frame).toBeDefined()
    if (frame?.t !== 'terminal:paste-image') throw new Error('unreachable')
    expect(frame.id).toBe('t1')
    expect(frame.mime).toBe('image/png')
    expect(frame.dataBase64).toBe('YWJj')

    ws.receive({
      t: 'terminal:image-pasted',
      reqId: frame.reqId,
      id: 't1',
      result: 'ok',
      path: '/tmp/x.png',
    })
    await expect(pasted).resolves.toEqual({ result: 'ok', path: '/tmp/x.png' })
  })

  it('rejects a pending paste-image request on close, same as create/attach', async () => {
    const pasted = daemon.pasteImageToTerminal('t1', 'image/png', 'YWJj')
    const ws = latest()
    const rejects = expect(pasted).rejects.toThrow(/daemon connection dropped/)
    ws.drop()
    await rejects
  })

  it('sends a generic file upload without a daemon-local path and settles its reply', async () => {
    const pasted = daemon.pasteFileToTerminal('t1', 'notes.txt', 'text/plain', 'YWJj')
    const ws = latest()
    ws.open()
    deliverReady(ws)

    const frame = sentMessages(ws).find((message) => message.t === 'terminal:paste-file')
    if (frame?.t !== 'terminal:paste-file') throw new Error('expected a file upload frame')
    expect(frame).toMatchObject({ filename: 'notes.txt', id: 't1', mime: 'text/plain' })

    ws.receive({
      t: 'terminal:file-pasted',
      reqId: frame.reqId,
      id: 't1',
      result: 'ok',
      path: '/daemon/terminal-pastes/notes.txt',
    })
    await expect(pasted).resolves.toEqual({
      result: 'ok',
      path: '/daemon/terminal-pastes/notes.txt',
    })
  })
})
