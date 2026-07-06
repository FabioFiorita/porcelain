import { createServer, type IncomingMessage, type Server, type ServerResponse } from 'node:http'
import type { Duplex } from 'node:stream'
import { findLanAddresses, lanDisplayHost } from './lan'
import { findTailscaleAddress } from './tailnet'

/**
 * The optional SECOND daemon listeners — bound to non-loopback private interfaces
 * so other devices the user trusts can reach the daemon, always behind the same
 * token gate as loopback and never 0.0.0.0 (see the audit skill + server.ts):
 *
 * - the **tailnet** listener binds the Tailscale interface (100.64/10) — the
 *   away-from-home path, WireGuard-encrypted at the network layer.
 * - the **LAN** listener binds the machine's RFC1918 private addresses — the
 *   at-home path (same Wi-Fi, no Tailscale hop); traffic is cleartext on the LAN
 *   (accepted, opt-in, default off — see the audit skill's recorded tradeoff).
 *
 * Both are the same shape, so they're two instances of one factory
 * (`createIfaceListener`). The request/upgrade handlers live in server.ts (they
 * close over the token digest and the WS session plumbing); the module is handed
 * them once via `initIfaceHandlers` at boot, then owns the second http.Server(s)
 * so the API's setTailnetBind/setLanBind mutations can start/stop them live
 * without importing server.ts (which would drag in the daemon's `main()` side
 * effects).
 */
export const LISTENER_PORT = 43117
/** Back-compat alias — the fixed port both second listeners bind. */
export const TAILNET_PORT = LISTENER_PORT

type RequestHandler = (req: IncomingMessage, res: ServerResponse) => void
type UpgradeHandler = (req: IncomingMessage, socket: Duplex, head: Buffer) => void

let requestHandler: RequestHandler | null = null
let upgradeHandler: UpgradeHandler | null = null

/** Register the shared handlers (called once from server.ts before any listen). */
export function initIfaceHandlers(request: RequestHandler, upgrade: UpgradeHandler): void {
  requestHandler = request
  upgradeHandler = upgrade
}

export interface IfaceListener {
  /**
   * Bind one http.Server per picked address on `LISTENER_PORT`. Resolves the
   * formatted url, or `null` when there's no matching interface (caller reports
   * "unavailable"). Idempotent: a second call while up returns the current url. A
   * per-address listen error is logged to stderr and that address is skipped — it
   * must NEVER take the loopback listener (a separate server) down, and if some
   * addresses bind it stays up on those. When nothing binds, `error()` says why.
   */
  start: () => Promise<string | null>
  /** Tear down every bound server if any are up (no-op otherwise). */
  stop: () => Promise<void>
  /** The live formatted url, or null when this listener isn't up. */
  url: () => string | null
  /** The live numeric addresses currently bound (empty when down). */
  addresses: () => string[]
  /**
   * Why the last `start()` ended with nothing bound: `'in-use'` when at least one
   * attempted bind failed with EADDRINUSE (e.g. a stale daemon still squatting the
   * fixed port) — so the UI can say "port in use" instead of the misleading "no
   * interface found". `null` otherwise, including the genuinely-no-interface case.
   * Reset at the start of every `start()` run and cleared by `stop()`.
   */
  error: () => 'in-use' | null
}

/**
 * One second-listener instance. `pickAddresses` returns the interfaces to bind
 * (a one-element array for the tailnet, possibly several for the LAN);
 * `formatUrl` turns the bound addresses into the url the UI shows. `label` names
 * the instance in stderr on a listen error.
 */
export function createIfaceListener(
  pickAddresses: () => string[],
  formatUrl: (addresses: string[]) => string | null,
  label: string,
): IfaceListener {
  let servers: Server[] = []
  let bound: string[] = []
  let lastError: 'in-use' | null = null

  function url(): string | null {
    return servers.length > 0 ? formatUrl(bound) : null
  }

  function start(): Promise<string | null> {
    if (servers.length > 0) return Promise.resolve(url())
    if (requestHandler === null || upgradeHandler === null) {
      throw new Error('iface-listener: initIfaceHandlers has not been called')
    }
    lastError = null
    const found = pickAddresses()
    if (found.length === 0) return Promise.resolve(null)
    const request = requestHandler
    const upgrade = upgradeHandler
    let sawInUse = false
    return Promise.all(
      found.map(
        (addr) =>
          new Promise<string | null>((resolve) => {
            const listener = createServer(request)
            listener.on('upgrade', upgrade)
            listener.once('error', (error) => {
              // EADDRINUSE = the fixed port is squatted (typically a stale daemon
              // that outlived its parent) — remember it so error() can distinguish
              // "port in use" from "no interface found" when nothing binds.
              if ((error as NodeJS.ErrnoException).code === 'EADDRINUSE') sawInUse = true
              console.error(`[daemon] ${label} listener failed on ${addr}:`, error)
              listener.close()
              resolve(null)
            })
            listener.listen(LISTENER_PORT, addr, () => {
              servers.push(listener)
              resolve(addr)
            })
          }),
      ),
    ).then((results) => {
      bound = results.filter((addr): addr is string => addr !== null)
      if (bound.length === 0 && sawInUse) lastError = 'in-use'
      return url()
    })
  }

  function stop(): Promise<void> {
    lastError = null
    const current = servers
    servers = []
    bound = []
    if (current.length === 0) return Promise.resolve()
    return Promise.all(
      current.map((s) => new Promise<void>((resolve) => s.close(() => resolve()))),
    ).then(() => undefined)
  }

  return { start, stop, url, addresses: () => [...bound], error: () => lastError }
}

// The tailnet instance: a single Tailscale address, formatted numerically (the
// CGNAT address is stable, so no hostname trick).
const tailnet = createIfaceListener(
  () => {
    const found = findTailscaleAddress()
    return found === null ? [] : [found]
  },
  (addresses) => (addresses[0] !== undefined ? `http://${addresses[0]}:${LISTENER_PORT}` : null),
  'tailnet',
)

// The LAN instance: every RFC1918 address, url'd via the `.local` Bonjour name
// (DHCP-stable) with the numeric address exposed separately as a fallback.
const lan = createIfaceListener(
  findLanAddresses,
  (addresses) => {
    const displayHost = lanDisplayHost(addresses)
    return displayHost === null ? null : `http://${displayHost}:${LISTENER_PORT}`
  },
  'lan',
)

export const startTailnetListener = tailnet.start
export const stopTailnetListener = tailnet.stop
export const tailnetUrl = tailnet.url
export const tailnetBindError = tailnet.error

export const startLanListener = lan.start
export const stopLanListener = lan.stop
export const lanUrl = lan.url
export const lanBindError = lan.error

/** The LAN listener's numeric url (first bound address), for the UI's fallback line. */
export function lanNumericUrl(): string | null {
  const [first] = lan.addresses()
  return first !== undefined ? `http://${first}:${LISTENER_PORT}` : null
}
