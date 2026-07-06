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
 *
 * The range is shared RFC-6598 CGNAT space, so in theory a non-Tailscale interface
 * (carrier NAT, another mesh VPN) could also match. Three cases: 0 matches → null;
 * exactly 1 match → return it (the common case); ≥2 distinct matches → prefer a
 * candidate whose interface name starts with `tailscale` (the Linux convention),
 * and if that doesn't uniquely resolve, fail closed (log + null) rather than bind an
 * arbitrary interface — the Settings toggle already surfaces the unavailable state.
 * (macOS names every VPN `utunN`, so on macOS an ambiguous setup always fails closed.)
 */
export function findTailscaleAddress(
  interfaces: ReturnType<typeof networkInterfaces> = networkInterfaces(),
): string | null {
  const matches: { name: string; address: string }[] = []
  for (const [name, addrs] of Object.entries(interfaces)) {
    for (const addr of addrs ?? []) {
      if (addr.internal || addr.family !== 'IPv4') continue
      const [first, second] = addr.address.split('.').map(Number)
      if (first === 100 && second >= 64 && second <= 127)
        matches.push({ name, address: addr.address })
    }
  }

  const distinct = [...new Set(matches.map((m) => m.address))]
  if (distinct.length === 0) return null
  if (distinct.length === 1) return distinct[0]

  const named = matches.filter((m) => m.name.startsWith('tailscale'))
  const namedDistinct = [...new Set(named.map((m) => m.address))]
  if (namedDistinct.length === 1) return namedDistinct[0]

  console.error(
    `findTailscaleAddress: ambiguous multiple 100.64/10 candidates, refusing to bind: ${matches
      .map((m) => `${m.name}=${m.address}`)
      .join(', ')}`,
  )
  return null
}
