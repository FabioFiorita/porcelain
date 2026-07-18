import { createServer, type Server } from 'node:http'
import { type AddressInfo, createServer as createNetServer } from 'node:net'
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest'
import { createIfaceListener, type IfaceListener, initIfaceHandlers } from './tailnet-listener'

// The ephemeral port every listener in this suite binds (picked in beforeAll).
let testPort: number
let loopbackUrl: string

// The factory refuses to start before the shared handlers are registered; the
// tests never issue a request, so no-op handlers suffice.
beforeAll(async () => {
  initIfaceHandlers(
    (_req, res) => res.end(),
    (_req, socket) => socket.destroy(),
  )
  // The tests bind REAL sockets, but on an ephemeral port THIS suite owns —
  // never the production LISTENER_PORT, which a live daemon on the same host may
  // already be squatting. Probe for a free one and thread it through the factory.
  testPort = await freePort()
  loopbackUrl = `http://127.0.0.1:${testPort}`
})

// Bind a throwaway server on port 0 to learn a free port, then release it.
function freePort(): Promise<number> {
  return new Promise<number>((resolve, reject) => {
    const probe = createNetServer()
    probe.once('error', reject)
    probe.listen(0, '127.0.0.1', () => {
      const { port } = probe.address() as AddressInfo
      probe.close(() => resolve(port))
    })
  })
}

// A loopback-only instance: the tests exercise REAL binds, but only ever on
// 127.0.0.1 (never a network interface), on the suite's own port. reconcileMs=0
// disables the background re-scan so tests stay deterministic.
const loopbackListener = (): IfaceListener =>
  createIfaceListener(
    () => ['127.0.0.1'],
    (addresses) => (addresses[0] !== undefined ? `http://${addresses[0]}:${testPort}` : null),
    'test',
    0,
    testPort,
  )

// Squat the suite's port with a plain http server so the factory's bind fails
// with a genuine EADDRINUSE (the stale-daemon scenario) on the listener's OWN port.
async function squatPort(): Promise<Server> {
  const server = createServer()
  await new Promise<void>((resolve) => server.listen(testPort, '127.0.0.1', () => resolve()))
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
      testPort,
    )
    expect(await listener.start()).toBeNull()
    expect(listener.error()).toBeNull()
    expect(listener.url()).toBeNull()
    // Empty pick is now logged (was a silent no-op) so ops can see a boot race.
    expect(errorSpy).toHaveBeenCalled()
  })

  it("is 'in-use' when the port is already bound (a stale daemon squatting it)", async () => {
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
    expect(await listener.start()).toBe(loopbackUrl)
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
    expect(await listener.start()).toBe(loopbackUrl)
    expect(listener.error()).toBeNull()
  })
})

describe('createIfaceListener reconcile()', () => {
  it('binds an address that appears after a prior empty start (boot-race recovery)', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    let addresses: string[] = []
    listener = createIfaceListener(
      () => addresses,
      (addrs) => (addrs[0] !== undefined ? `http://${addrs[0]}:${testPort}` : null),
      'test',
      0,
      testPort,
    )
    // Boot race: no interface yet.
    expect(await listener.start()).toBeNull()
    expect(listener.addresses()).toEqual([])
    // Interface comes up (DHCP / Tailscale / resume) — re-start reconciles.
    addresses = ['127.0.0.1']
    expect(await listener.start()).toBe(loopbackUrl)
    expect(listener.addresses()).toEqual(['127.0.0.1'])
  })

  it('is safe to call start() repeatedly while already bound (no double-bind)', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    listener = loopbackListener()
    expect(await listener.start()).toBe(loopbackUrl)
    expect(await listener.start()).toBe(loopbackUrl)
    expect(listener.addresses()).toEqual(['127.0.0.1'])
  })

  it('closes a stale bind when the address disappears from the pick', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    let addresses: string[] = ['127.0.0.1']
    listener = createIfaceListener(
      () => addresses,
      (addrs) => (addrs[0] !== undefined ? `http://${addrs[0]}:${testPort}` : null),
      'test',
      0,
      testPort,
    )
    expect(await listener.start()).toBe(loopbackUrl)
    addresses = []
    expect(await listener.start()).toBeNull()
    expect(listener.addresses()).toEqual([])
    expect(listener.url()).toBeNull()
  })
})
