import { hostname, networkInterfaces } from 'node:os'

/**
 * Find this machine's private-range (RFC 1918) IPv4 addresses so the daemon can
 * additionally listen on the home LAN — the same token-gated surface as the
 * tailnet listener, for the at-home case where the iPad and the Mac are already
 * on the same Wi-Fi and Tailscale would be an unnecessary hop (see the audit
 * skill's listener/bind invariant + the LAN block in server.ts).
 *
 * The three private ranges are 10.0.0.0/8, 172.16.0.0/12, and 192.168.0.0/16.
 * The Tailscale CGNAT range 100.64.0.0/10 is deliberately NOT here — that's the
 * tailnet's, handled by `findTailscaleAddress`; a private-range match never
 * overlaps it. Wi-Fi and Ethernet can both be up, so we return ALL matches (in
 * enumeration order) rather than guessing one. `interfaces` is injectable for
 * tests, mirroring `tailnet.ts`.
 */
export function findLanAddresses(
  interfaces: ReturnType<typeof networkInterfaces> = networkInterfaces(),
): string[] {
  const matches: string[] = []
  for (const addrs of Object.values(interfaces)) {
    for (const addr of addrs ?? []) {
      if (addr.internal || addr.family !== 'IPv4') continue
      const [first, second] = addr.address.split('.').map(Number)
      const isPrivate =
        first === 10 ||
        (first === 172 && second >= 16 && second <= 31) ||
        (first === 192 && second === 168)
      if (isPrivate) matches.push(addr.address)
    }
  }
  return matches
}

/**
 * The Bonjour name other LAN devices can resolve without any advertisement —
 * macOS publishes `<hostname>.local` natively, so the URL we surface prefers it
 * over a bare numeric address (which can change with DHCP). Appends `.local`
 * when the hostname lacks it; falls back to the first numeric address when the
 * hostname is unusable; returns null when there are no addresses at all.
 */
export function lanDisplayHost(addresses: string[]): string | null {
  if (addresses.length === 0) return null
  const host = hostname()
  if (host !== '' && host !== 'localhost') {
    return host.endsWith('.local') ? host : `${host}.local`
  }
  return addresses[0]
}
