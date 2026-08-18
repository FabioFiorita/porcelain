import { hostname, networkInterfaces } from 'node:os'

/**
 * Interface-name prefixes we never bind, matched case-insensitively.
 *
 * A DENY list, not an allow list: physical NIC names vary far too much to
 * enumerate (`en0`, `eth0`, `wls1`, `enp3s0`, vendor-renamed oddities), so an
 * allow list would silently kill LAN access on a legitimate NIC. The RFC1918
 * range check in `findLanAddresses` is the fail-closed half; this list only has
 * to cover the real-world virtual/container/VPN families. Reading the
 * default-route interface instead was rejected — it needs platform-specific route
 * parsing or a spawn inside a security-sensitive bind path.
 *
 * TRAP — `br-` keeps its hyphen on purpose. It targets Docker's user-defined
 * bridges (`br-e6c014ebe2d8`); macOS `bridge0` is a REAL Thunderbolt/Ethernet
 * bridge and must keep working, so never shorten this to `br`.
 *
 * `tailscale*` / `utun*` are here because `findTailscaleAddress` owns that path —
 * the overlap would be harmless, but excluding them stops a non-default Tailscale
 * setup from getting two listeners on one address.
 */
const DENIED_IFACE_PREFIXES = [
  'docker',
  'br-',
  'veth',
  'virbr',
  'lxdbr',
  'lxc',
  'vboxnet',
  'vmnet',
  'tun',
  'tap',
  'wg',
  'ppp',
  'zt',
  'cni',
  'flannel',
  'kube',
  'cali',
  'nerdctl',
  'podman',
  'tailscale',
  'utun',
  'awdl',
  'llw',
]

function isDeniedIface(name: string): boolean {
  const lower = name.toLowerCase()
  return DENIED_IFACE_PREFIXES.some((prefix) => lower.startsWith(prefix))
}

/**
 * This machine's private-range (RFC 1918) IPv4 addresses, so the daemon can also
 * listen on the home LAN behind the same token gate (see docs/remote-access.md).
 * 10/8, 172.16/12, 192.168/16 only — Tailscale's CGNAT 100.64/10 belongs to
 * `findTailscaleAddress` and never overlaps. Wi-Fi and Ethernet can both be up, so
 * ALL matches return in enumeration order rather than guessing one. Range alone is
 * NOT enough — `DENIED_IFACE_PREFIXES` above carries the interface filter and why.
 */
export function findLanAddresses(
  interfaces: ReturnType<typeof networkInterfaces> = networkInterfaces(),
): string[] {
  const matches: string[] = []
  for (const [name, addrs] of Object.entries(interfaces)) {
    if (isDeniedIface(name)) continue
    for (const addr of addrs ?? []) {
      if (addr.internal || addr.family !== 'IPv4') continue
      const [first, second] = addr.address.split('.').map(Number)
      if (first === undefined || second === undefined) continue
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
 * The Bonjour name LAN devices resolve without advertisement — macOS publishes
 * `<hostname>.local`, so a surfaced URL prefers it over a DHCP-mutable numeric
 * address; falls back to the first numeric address, else null. TRAP — a DISPLAY
 * host, not a reachable one: on a Linux daemon host avahi answers `.local` with
 * AAAA while these listeners are IPv4-only, so an IPv6-preferring peer resolves
 * the name and connects to nothing. Clients get `lanNumericUrl()` instead.
 */
export function lanDisplayHost(addresses: string[]): string | null {
  if (addresses.length === 0) return null
  const host = hostname()
  if (host !== '' && host !== 'localhost') {
    return host.endsWith('.local') ? host : `${host}.local`
  }
  return addresses[0] ?? null
}
