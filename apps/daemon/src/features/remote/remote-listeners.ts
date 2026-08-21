import { createServer, type IncomingMessage, type Server, type ServerResponse } from 'node:http'
import type { Duplex } from 'node:stream'
import { findLanAddresses, lanDisplayHost } from './remote-lan'
import { findTailscaleAddress } from './remote-tailnet'

/**
 * The optional SECOND daemon listeners — bound to non-loopback private interfaces so
 * other devices the user trusts can reach the daemon, always behind the same token
 * gate as loopback and never 0.0.0.0 (Remote boundary + server.ts): the **tailnet**
 * listener binds the Tailscale interface (100.64/10), the **LAN** listener binds the
 * machine's RFC1918 addresses. Same shape, so they are two instances of one factory
 * (`createIfaceListener`). The external request/upgrade handlers live in server.ts and are
 * handed over once via `initIfaceHandlers`, so start/stop can go live without
 * importing server.ts (which would drag in the daemon's `main()` side effects).
 *
 * **Port = the daemon port.** Loopback and iface listeners share one port from
 * `PORCELAIN_DAEMON_PORT` (default 43117), so `serve --port 9999 --lan` and the dev
 * stack on 43118 stay reachable at that port on every bind. The Electron-spawned local
 * child leaves the env unset (loopback gets an OS port; Share still binds 43117).
 *
 * **Reconcile, not bind-once.** Addresses appear after boot (DHCP race, resume,
 * Tailscale up, Wi-Fi join), so `start()` binds newly-appeared addresses and closes
 * sockets whose address vanished, safe to call repeatedly; while enabled an interval
 * re-scans `os.networkInterfaces()`.
 */

/** Default share/daemon port when `PORCELAIN_DAEMON_PORT` is unset or invalid. */
export const LISTENER_PORT = 43117

/**
 * Port LAN/tailnet listeners bind. Same as the pinned loopback port when
 * `PORCELAIN_DAEMON_PORT` is set; otherwise the default 43117.
 */
export function ifaceListenerPort(): number {
  const raw = process.env.PORCELAIN_DAEMON_PORT
  if (raw === undefined || raw === '') return LISTENER_PORT
  const n = Number(raw)
  if (!Number.isInteger(n) || n <= 0 || n > 65535) return LISTENER_PORT
  return n
}

/** How often an enabled listener re-scans interfaces and reconciles binds. */
const IFACE_RECONCILE_MS = 5_000

type RequestHandler = (req: IncomingMessage, res: ServerResponse) => void
type UpgradeHandler = (req: IncomingMessage, socket: Duplex, head: Buffer) => void

let externalRequestHandler: RequestHandler | null = null
let upgradeHandler: UpgradeHandler | null = null

/**
 * Register the handlers (called once from server.ts before any listen).
 *
 * The optional third argument keeps small listener-only callers source-compatible,
 * but production always supplies it. Interface listeners must use the external
 * handler so the token-free MCP route remains structurally loopback-only.
 */
export function initIfaceHandlers(
  request: RequestHandler,
  upgrade: UpgradeHandler,
  externalRequest: RequestHandler = request,
): void {
  externalRequestHandler = externalRequest
  upgradeHandler = upgrade
}

export interface IfaceListener {
  /**
   * Enable the listener and reconcile binds against the current interfaces.
   * Resolves the formatted url, or `null` when there's no matching interface.
   * Safe to call repeatedly — bind new addresses, close stale ones. A per-address
   * listen error is logged and that address skipped; it must NEVER take the
   * loopback listener (a separate server) down. While enabled a background
   * interval re-runs the reconcile so later-appearing addresses are picked up.
   */
  start: () => Promise<string | null>
  /** Disable the listener and tear down every bound server (no-op otherwise). */
  stop: () => Promise<void>
  /** The live formatted url, or null when this listener isn't up. */
  url: () => string | null
  /** The live numeric addresses currently bound (empty when down). */
  addresses: () => string[]
  /**
   * Why the last reconcile ended with nothing bound: `'in-use'` when at least one
   * attempted bind failed with EADDRINUSE (e.g. a stale daemon still squatting the
   * fixed port) — so the UI can say "port in use" instead of the misleading "no
   * interface found". `null` otherwise, including the genuinely-no-interface case.
   * Reset at the start of every reconcile and cleared by `stop()`.
   */
  error: () => 'in-use' | null
}

/**
 * One second-listener instance. `pickAddresses` returns the interfaces to bind (one
 * for the tailnet, possibly several for the LAN); `formatUrl` turns them into the url
 * the UI shows; `label` names the instance in stderr on a listen error. `reconcileMs`
 * is injectable so tests don't wait the production 5s (0 disables the timer). `port`
 * defaults to `ifaceListenerPort()` at each bind; tests pass an ephemeral one so the
 * suite doesn't collide with a live daemon squatting 43117.
 */
export function createIfaceListener(
  pickAddresses: () => string[],
  formatUrl: (addresses: string[]) => string | null,
  label: string,
  reconcileMs: number = IFACE_RECONCILE_MS,
  port?: number,
): IfaceListener {
  let servers: Server[] = []
  let bound: string[] = []
  let lastError: 'in-use' | null = null
  /** True while the user/config wants this listener up — drives the re-scan timer. */
  let wanted = false
  let timer: ReturnType<typeof setInterval> | null = null
  /** Serialize concurrent start/stop/timer reconciles so socket bookkeeping stays coherent. */
  let chain: Promise<unknown> = Promise.resolve()
  /** Avoid spamming stderr every interval while addresses are still missing. */
  let loggedEmpty = false

  function resolvePort(): number {
    return port ?? ifaceListenerPort()
  }

  function url(): string | null {
    return servers.length > 0 ? formatUrl(bound) : null
  }

  function clearTimer(): void {
    if (timer === null) return
    clearInterval(timer)
    timer = null
  }

  function scheduleTimer(): void {
    if (timer !== null || reconcileMs <= 0) return
    timer = setInterval(() => {
      if (!wanted) return
      chain = chain.then(() => reconcile()).catch(() => null)
    }, reconcileMs)
    // Don't keep the process alive solely for the re-scan — the loopback listener does.
    timer.unref()
  }

  function closeServer(server: Server): Promise<void> {
    return new Promise<void>((resolve) => {
      server.close(() => resolve())
    })
  }

  async function closeAll(): Promise<void> {
    const current = servers
    servers = []
    bound = []
    if (current.length === 0) return
    await Promise.all(current.map(closeServer))
  }

  async function bindOne(
    addr: string,
  ): Promise<{ server: Server; addr: string } | { failed: 'in-use' | 'other' }> {
    if (externalRequestHandler === null || upgradeHandler === null) {
      throw new Error('iface-listener: initIfaceHandlers has not been called')
    }
    const request = externalRequestHandler
    const upgrade = upgradeHandler
    return new Promise((resolve) => {
      const listener = createServer(request)
      listener.on('upgrade', upgrade)
      listener.once('error', (error) => {
        // EADDRINUSE = the bound port is squatted (typically a stale daemon that
        // outlived its parent) — remember it so error() can distinguish "port in
        // use" from "no interface found" when nothing binds.
        const inUse = (error as NodeJS.ErrnoException).code === 'EADDRINUSE'
        console.error(`[daemon] ${label} listener failed on ${addr}:`, error)
        listener.close()
        resolve({ failed: inUse ? 'in-use' : 'other' })
      })
      const listenPort = resolvePort()
      listener.listen(listenPort, addr, () => {
        console.error(`[daemon] ${label} listener bound on ${addr}:${listenPort}`)
        resolve({ server: listener, addr })
      })
    })
  }

  async function reconcile(): Promise<string | null> {
    if (externalRequestHandler === null || upgradeHandler === null) {
      throw new Error('iface-listener: initIfaceHandlers has not been called')
    }
    // Only clear 'in-use' when we start a fresh pass; a mid-pass bind failure
    // sets it again below. Don't clear if we're about to discover empty interfaces.
    lastError = null
    const found = pickAddresses()
    const foundSet = new Set(found)

    // Close sockets whose address disappeared (stale bind on a removed IP).
    const keepServers: Server[] = []
    const keepBound: string[] = []
    const drop: Server[] = []
    for (let i = 0; i < servers.length; i++) {
      const addr = bound[i]
      const server = servers[i]
      if (addr !== undefined && server !== undefined && foundSet.has(addr)) {
        keepServers.push(server)
        keepBound.push(addr)
      } else if (server !== undefined) {
        drop.push(server)
      }
    }
    if (drop.length > 0) {
      await Promise.all(drop.map(closeServer))
      console.error(
        `[daemon] ${label} listener: closed ${drop.length} stale address(es); still bound: [${keepBound.join(', ')}]`,
      )
    }
    servers = keepServers
    bound = keepBound

    if (found.length === 0) {
      if (!loggedEmpty) {
        console.error(
          `[daemon] ${label} listener: no matching interface addresses (will re-scan every ${reconcileMs}ms)`,
        )
        loggedEmpty = true
      }
      return null
    }
    loggedEmpty = false

    const boundSet = new Set(bound)
    const toBind = found.filter((addr) => !boundSet.has(addr))
    if (toBind.length === 0) return url()

    let sawInUse = false
    const results = await Promise.all(toBind.map((addr) => bindOne(addr)))
    for (const result of results) {
      if ('failed' in result) {
        if (result.failed === 'in-use') sawInUse = true
        continue
      }
      servers.push(result.server)
      bound.push(result.addr)
    }
    // Only report 'in-use' when NOTHING bound — a partial success is still up.
    if (bound.length === 0 && sawInUse) lastError = 'in-use'
    return url()
  }

  function start(): Promise<string | null> {
    wanted = true
    scheduleTimer()
    const run = chain.then(() => reconcile())
    // The caller owns `run`'s rejection; this tail only keeps the chain alive so a
    // failed start never blocks a later start/stop.
    chain = Promise.allSettled([run]).then(() => undefined)
    return run
  }

  function stop(): Promise<void> {
    wanted = false
    clearTimer()
    loggedEmpty = false
    const run = chain.then(async () => {
      lastError = null
      await closeAll()
    })
    // The caller owns `run`'s rejection; this tail only keeps the chain alive so a
    // failed stop never blocks a later start/stop.
    chain = Promise.allSettled([run]).then(() => undefined)
    return run
  }

  return { start, stop, url, addresses: () => [...bound], error: () => lastError }
}

// The tailnet instance: a single Tailscale address, formatted numerically (the
// CGNAT address is stable, so no hostname trick). Port resolved at bind/URL time
// so PORCELAIN_DAEMON_PORT is respected without recreating the singleton.
const tailnet = createIfaceListener(
  () => {
    const found = findTailscaleAddress()
    return found === null ? [] : [found]
  },
  (addresses) =>
    addresses[0] !== undefined ? `http://${addresses[0]}:${ifaceListenerPort()}` : null,
  'tailnet',
)

// The LAN instance: every RFC1918 address, url'd via the `.local` Bonjour name
// (DHCP-stable) with the numeric address exposed separately as a fallback.
const lan = createIfaceListener(
  findLanAddresses,
  (addresses) => {
    const displayHost = lanDisplayHost(addresses)
    return displayHost === null ? null : `http://${displayHost}:${ifaceListenerPort()}`
  },
  'lan',
)

export const startTailnetListener: () => Promise<string | null> = tailnet.start
export const stopTailnetListener: () => Promise<void> = tailnet.stop
export const tailnetUrl: () => string | null = tailnet.url
export const tailnetBindError: () => 'in-use' | null = tailnet.error

export const startLanListener: () => Promise<string | null> = lan.start
export const stopLanListener: () => Promise<void> = lan.stop
export const lanUrl: () => string | null = lan.url
export const lanBindError: () => 'in-use' | null = lan.error

/** The LAN listener's numeric url (first bound address), for the UI's fallback line. */
export function lanNumericUrl(): string | null {
  const [first] = lan.addresses()
  return first !== undefined ? `http://${first}:${ifaceListenerPort()}` : null
}
