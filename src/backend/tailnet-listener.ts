import { createServer, type IncomingMessage, type Server, type ServerResponse } from 'node:http'
import type { Duplex } from 'node:stream'
import { findTailscaleAddress } from './tailnet'

/**
 * The optional second daemon listener, bound to the machine's Tailscale interface
 * (100.64/10) so other devices on the user's tailnet can reach the daemon — same
 * token gate as loopback, never 0.0.0.0 (see the audit skill + server.ts).
 *
 * The request/upgrade handlers live in server.ts (they close over the token
 * digest and the WS session plumbing); this module is handed them once via
 * `initTailnetHandlers` at boot, then owns the second http.Server so the API's
 * setTailnetBind mutation can start/stop it live without importing server.ts
 * (which would drag in the daemon's top-level `main()` side effects).
 */
export const TAILNET_PORT = 43117

type RequestHandler = (req: IncomingMessage, res: ServerResponse) => void
type UpgradeHandler = (req: IncomingMessage, socket: Duplex, head: Buffer) => void

let requestHandler: RequestHandler | null = null
let upgradeHandler: UpgradeHandler | null = null
let server: Server | null = null
let address: string | null = null

/** Register the shared handlers (called once from server.ts before listen). */
export function initTailnetHandlers(request: RequestHandler, upgrade: UpgradeHandler): void {
  requestHandler = request
  upgradeHandler = upgrade
}

/** The live tailnet url, or null when the second listener isn't up. */
export function tailnetUrl(): string | null {
  return server !== null && address !== null ? `http://${address}:${TAILNET_PORT}` : null
}

/**
 * Start the tailnet listener on the detected Tailscale address, or resolve `null`
 * when there's no Tailscale interface (caller reports "unavailable"). Idempotent:
 * a second call while up returns the current url. A listen error (e.g. the address
 * vanished) is logged to stderr and treated as unavailable — it must never take
 * the loopback listener down.
 */
export function startTailnetListener(): Promise<string | null> {
  if (server !== null) return Promise.resolve(tailnetUrl())
  if (requestHandler === null || upgradeHandler === null) {
    throw new Error('tailnet-listener: initTailnetHandlers has not been called')
  }
  const found = findTailscaleAddress()
  if (found === null) return Promise.resolve(null)
  const request = requestHandler
  const upgrade = upgradeHandler
  return new Promise((resolve) => {
    const listener = createServer(request)
    listener.on('upgrade', upgrade)
    listener.once('error', (error) => {
      console.error('[daemon] tailnet listener failed:', error)
      listener.close()
      server = null
      address = null
      resolve(null)
    })
    listener.listen(TAILNET_PORT, found, () => {
      server = listener
      address = found
      resolve(tailnetUrl())
    })
  })
}

/** Tear down the tailnet listener if it's up (no-op otherwise). */
export function stopTailnetListener(): Promise<void> {
  const listener = server
  server = null
  address = null
  if (listener === null) return Promise.resolve()
  return new Promise((resolve) => listener.close(() => resolve()))
}
