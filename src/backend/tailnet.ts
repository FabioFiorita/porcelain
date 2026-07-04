import { networkInterfaces } from 'node:os'

/**
 * Find this machine's Tailscale IPv4 address, or null if it isn't on a tailnet.
 *
 * Tailscale hands every node a stable address inside the CGNAT range
 * 100.64.0.0/10 (RFC 6598) — first octet 100, second octet 64–127. That's the
 * only interface the daemon is ever allowed to bind besides loopback (see the
 * audit skill): a public 0.0.0.0 bind would expose the token-gated shell channel
 * to the whole LAN, whereas the tailnet is an authenticated, encrypted overlay.
 * We match the range rather than the `utun`/`tailscale0` interface name so it
 * works regardless of what the OS calls the interface. `interfaces` is injectable
 * for tests.
 */
export function findTailscaleAddress(
  interfaces: ReturnType<typeof networkInterfaces> = networkInterfaces(),
): string | null {
  for (const addrs of Object.values(interfaces)) {
    for (const addr of addrs ?? []) {
      if (addr.internal || addr.family !== 'IPv4') continue
      const [first, second] = addr.address.split('.').map(Number)
      if (first === 100 && second >= 64 && second <= 127) return addr.address
    }
  }
  return null
}
