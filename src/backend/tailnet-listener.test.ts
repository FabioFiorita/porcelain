import { createServer, type Server } from 'node:http'
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest'
import {
  createIfaceListener,
  type IfaceListener,
  initIfaceHandlers,
  LISTENER_PORT,
} from './tailnet-listener'

// The factory refuses to start before the shared handlers are registered; the
// tests never issue a request, so no-op handlers suffice.
beforeAll(() => {
  initIfaceHandlers(
    (_req, res) => res.end(),
    (_req, socket) => socket.destroy(),
  )
})

// A loopback-only instance: the tests exercise REAL binds, but only ever on
// 127.0.0.1 (never a network interface), on the real fixed port. reconcileMs=0
// disables the background re-scan so tests stay deterministic.
const loopbackListener = (): IfaceListener =>
  createIfaceListener(
    () => ['127.0.0.1'],
    (addresses) => (addresses[0] !== undefined ? `http://${addresses[0]}:${LISTENER_PORT}` : null),
    'test',
    0,
  )

const LOOPBACK_URL = `http://127.0.0.1:${LISTENER_PORT}`

// Squat the fixed port with a plain http server so the factory's bind fails
// with a genuine EADDRINUSE (the stale-daemon scenario).
async function squatPort(): Promise<Server> {
  const server = createServer()
  await new Promise<void>((resolve) => server.listen(LISTENER_PORT, '127.0.0.1', () => resolve()))
  return server
}

// Everything binds real sockets — close them all so the suite stays hermetic.
let listener: IfaceListener | null = null
let squatter: Server | null = null

afterEach(async () => {
  if (listener !== null) await listener.stop()
  listener = null
  if (squatter !== null) {
    const server = squatter
    squatter = null
    await new Promise<void>((resolve) => server.close(() => resolve()))
  }
  vi.restoreAllMocks()
})

describe('createIfaceListener error()', () => {
  it('is null when no interface matches — genuinely no interface, not a bind failure', async () => {
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    listener = createIfaceListener(
      () => [],
      () => null,
      'test',
      0,
    )
    expect(await listener.start()).toBeNull()
    expect(listener.error()).toBeNull()
    expect(listener.url()).toBeNull()
    // Empty pick is now logged (was a silent no-op) so ops can see a boot race.
    expect(errorSpy).toHaveBeenCalled()
  })

  it("is 'in-use' when the fixed port is already bound (a stale daemon squatting it)", async () => {
    // The factory logs each failed bind to stderr — keep that behavior but keep
    // the test output clean.
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    squatter = await squatPort()
    listener = loopbackListener()
    expect(await listener.start()).toBeNull()
    expect(listener.error()).toBe('in-use')
    expect(listener.url()).toBeNull()
    expect(errorSpy).toHaveBeenCalled()
  })

  it('is null after a successful bind, and start() resolves the formatted url', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    listener = loopbackListener()
    expect(await listener.start()).toBe(LOOPBACK_URL)
    expect(listener.error()).toBeNull()
    expect(listener.addresses()).toEqual(['127.0.0.1'])
  })

  it('is cleared by stop()', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    squatter = await squatPort()
    listener = loopbackListener()
    await listener.start()
    expect(listener.error()).toBe('in-use')
    await listener.stop()
    expect(listener.error()).toBeNull()
  })

  it('is reset by the next start() run — once the port frees up, the bind succeeds cleanly', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    const server = await squatPort()
    squatter = server
    listener = loopbackListener()
    await listener.start()
    expect(listener.error()).toBe('in-use')
    // Free the port (the stale daemon exits) and retry: the fresh run binds and
    // the stale 'in-use' must not linger.
    squatter = null
    await new Promise<void>((resolve) => server.close(() => resolve()))
    expect(await listener.start()).toBe(LOOPBACK_URL)
    expect(listener.error()).toBeNull()
  })
})

describe('createIfaceListener reconcile()', () => {
  it('binds an address that appears after a prior empty start (boot-race recovery)', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    let addresses: string[] = []
    listener = createIfaceListener(
      () => addresses,
      (addrs) => (addrs[0] !== undefined ? `http://${addrs[0]}:${LISTENER_PORT}` : null),
      'test',
      0,
    )
    // Boot race: no interface yet.
    expect(await listener.start()).toBeNull()
    expect(listener.addresses()).toEqual([])
    // Interface comes up (DHCP / Tailscale / resume) — re-start reconciles.
    addresses = ['127.0.0.1']
    expect(await listener.start()).toBe(LOOPBACK_URL)
    expect(listener.addresses()).toEqual(['127.0.0.1'])
  })

  it('is safe to call start() repeatedly while already bound (no double-bind)', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    listener = loopbackListener()
    expect(await listener.start()).toBe(LOOPBACK_URL)
    expect(await listener.start()).toBe(LOOPBACK_URL)
    expect(listener.addresses()).toEqual(['127.0.0.1'])
  })

  it('closes a stale bind when the address disappears from the pick', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    let addresses: string[] = ['127.0.0.1']
    listener = createIfaceListener(
      () => addresses,
      (addrs) => (addrs[0] !== undefined ? `http://${addrs[0]}:${LISTENER_PORT}` : null),
      'test',
      0,
    )
    expect(await listener.start()).toBe(LOOPBACK_URL)
    addresses = []
    expect(await listener.start()).toBeNull()
    expect(listener.addresses()).toEqual([])
    expect(listener.url()).toBeNull()
  })
})
