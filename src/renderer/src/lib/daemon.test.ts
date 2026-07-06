import { type ClientMessage, clientMessageSchema } from '@shared/ws-protocol'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

/**
 * Characterization tests for the renderer's ONE WebSocket client
 * (`@renderer/lib/daemon`): outbox queuing, pending create/attach rejection on
 * close, capped-backoff reconnect, watch-set + re-attach replay, and the
 * first-connect guard. These pin behavior as shipped — they are a tripwire for
 * the next change to reconnect semantics, not a spec to satisfy.
 *
 * The module is a module-scope singleton with no injection seam, so each test
 * gets fresh state via `vi.resetModules()` + a dynamic import, and drives a
 * controllable fake `WebSocket` installed with `vi.stubGlobal`.
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

/** The parsed (and schema-validated) client frames a socket has sent so far. */
function sentMessages(ws: FakeWebSocket): ClientMessage[] {
  return ws.sent.map((s) => clientMessageSchema.parse(JSON.parse(s)))
}

const latest = (): FakeWebSocket => FakeWebSocket.instances[FakeWebSocket.instances.length - 1]

let daemon: typeof import('@renderer/lib/daemon')

beforeEach(async () => {
  vi.useFakeTimers()
  FakeWebSocket.instances = []
  localStorage.clear()
  vi.stubGlobal('WebSocket', FakeWebSocket)
  vi.resetModules()
  daemon = await import('@renderer/lib/daemon')
})

afterEach(() => {
  // Step 4 (case 11): every frame the client emitted this test must be a valid
  // ClientMessage — pins the renderer to the same shared schema the daemon
  // validates against, so protocol drift fails a test on THIS side too.
  for (const ws of FakeWebSocket.instances) {
    for (const frame of ws.sent) {
      clientMessageSchema.parse(JSON.parse(frame))
    }
  }
  vi.unstubAllGlobals()
  vi.useRealTimers()
})

describe('daemon WS client', () => {
  it('opens one tokenless socket lazily (protocols [] under jsdom)', () => {
    daemon.watchFiles(['/a'])
    expect(FakeWebSocket.instances).toHaveLength(1)
    expect(latest().protocols).toEqual([])
    expect(latest().url).toMatch(/^ws.*\/session$/)
  })

  // --- Step 2: outbox + settlement ---

  it('queues a create while CONNECTING, flushes on open, resolves on reply', async () => {
    const created = daemon.createTerminal({ name: 't', cwd: '/x' })
    const ws = latest()
    expect(ws.sent).toEqual([]) // nothing sent while CONNECTING

    ws.open()
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

  it('does not queue fire-and-forget messages (write/kill) issued while CONNECTING', () => {
    daemon.onDaemonEvent(() => {}) // opens a CONNECTING socket without pushing
    const ws = latest()
    daemon.writeTerminal('id', 'x')
    daemon.killTerminal('id')
    expect(ws.sent).toEqual([]) // dropped, not queued

    ws.open()
    const kinds = sentMessages(ws).map((f) => f.t)
    expect(kinds).not.toContain('terminal:write')
    expect(kinds).not.toContain('terminal:kill')
    expect(ws.sent).toEqual([]) // nothing flushed at all (no watch sets, no outbox)
  })

  it('ignores invalid inbound frames; the socket survives to settle a later valid reply', async () => {
    const created = daemon.createTerminal({ name: 't', cwd: '/x' })
    const ws = latest()
    ws.open()
    const create = sentMessages(ws).find((f) => f.t === 'terminal:create')
    if (create?.t !== 'terminal:create') throw new Error('expected a create frame')

    ws.onmessage?.({ data: 'not json' }) // JSON.parse failure → ignored
    ws.receive({ t: 'nonsense' }) // schema failure → ignored
    ws.onmessage?.({ data: 42 }) // non-string data → ignored

    ws.receive({ t: 'terminal:created', reqId: create.reqId, id: 'survived' })
    await expect(created).resolves.toBe('survived')
  })

  // --- Step 3: reconnect ---

  it('reconnects with a new socket after backoff', () => {
    daemon.onDaemonEvent(() => {})
    const ws = latest()
    ws.open()
    ws.drop()
    expect(FakeWebSocket.instances).toHaveLength(1) // no immediate reconnect

    vi.advanceTimersByTime(500)
    expect(FakeWebSocket.instances).toHaveLength(2)
  })

  it('replays watch sets and re-attaches on REconnect, but not on the first connect', () => {
    daemon.watchFiles(['/a'])
    const attached = daemon.attachTerminal('t1')
    const ws1 = latest()

    ws1.open()
    // First open: exactly the queued attach — NOT a duplicate re-attach replay.
    const firstAttaches = sentMessages(ws1).filter((f) => f.t === 'terminal:attach')
    expect(firstAttaches).toHaveLength(1)
    const attach = firstAttaches[0]
    if (attach.t !== 'terminal:attach') throw new Error('unreachable')

    ws1.receive({
      t: 'terminal:attached',
      reqId: attach.reqId,
      id: 't1',
      scrollback: '',
      status: 'running',
      found: true,
    })
    // settle the initial attach so it does not leak across the reconnect
    return attached.then(() => {
      ws1.drop()
      vi.advanceTimersByTime(500)
      const ws2 = latest()
      expect(ws2).not.toBe(ws1)
      ws2.open()

      const frames = sentMessages(ws2)
      const watch = frames.find((f) => f.t === 'watch:files')
      expect(watch).toBeDefined()
      if (watch?.t === 'watch:files') expect(watch.paths).toEqual(['/a'])
      expect(frames.some((f) => f.t === 'terminal:attach')).toBe(true)
    })
  })

  it('fires reconnect listeners only on REconnect, never on the first connect', () => {
    const spy = vi.fn()
    daemon.onDaemonReconnect(spy)
    const ws1 = latest()
    ws1.open()
    expect(spy).not.toHaveBeenCalled() // first connect: no refetch

    ws1.drop()
    vi.advanceTimersByTime(500)
    latest().open()
    expect(spy).toHaveBeenCalledTimes(1)
  })

  it('caps the reconnect backoff at 10_000ms', () => {
    daemon.onDaemonEvent(() => {})
    latest().open() // resets backoff to 500

    // Drive the backoff up to its cap: drop each CONNECTING socket and let its
    // (ever-larger) timer fire. After ~6 cycles retryDelay is pinned at 10_000.
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

  it('setBrowserDaemonToken reconnects with the new subprotocol and refetches even on first connect', () => {
    const spy = vi.fn()
    daemon.onDaemonReconnect(spy) // opens ws0 (CONNECTING)

    daemon.setBrowserDaemonToken('tok') // closes ws0, reconnects immediately
    const ws = latest()
    expect(ws.protocols).toEqual(['porcelain.tok'])
    expect(localStorage.getItem('porcelain-daemon-token')).toBe('tok')

    ws.open()
    // recoveryPending makes this first successful connect fire the refetch listeners.
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
    ws2.open() // flushes the freshly-queued attach

    expect(daemon.isTerminalAttached('t2')).toBe(true)
    const attaches = sentMessages(ws2).filter((f) => f.t === 'terminal:attach')
    expect(attaches).toHaveLength(1)
    if (attaches[0].t !== 'terminal:attach') throw new Error('unreachable')
    expect(attaches[0].id).toBe('t2')

    // settle it so the pending attach doesn't leak past the test
    ws2.receive({
      t: 'terminal:attached',
      reqId: attaches[0].reqId,
      id: 't2',
      scrollback: '',
      status: 'running',
      found: true,
    })
    await expect(retry).resolves.toMatchObject({ found: true })
  })
})
