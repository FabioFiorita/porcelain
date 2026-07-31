import { hostname, networkInterfaces } from 'node:os'

/**
 * Interface-name prefixes we never bind, matched case-insensitively.
 *
 * A DENY list, not an allow list, and that direction is the decision: physical
 * NIC names vary far too much to enumerate (`en0`, `eth0`, `wls1`, `enp3s0`,
 * `eno1`, `wlp2s0`, vendor-renamed oddities), so an allow list would silently
 * kill LAN access on a legitimate-but-unrecognised NIC. The RFC1918 range check
 * in `findLanAddresses` is the fail-closed half (a public address can never get
 * through however the interface is named); this list only has to cover the
 * real-world virtual/container/VPN families.
 *
 * TRAP — `br-` keeps its hyphen on purpose. It targets Docker's user-defined
 * bridges (`br-e6c014ebe2d8`); macOS `bridge0` is a REAL Thunderbolt/Ethernet
 * bridge and must keep working, so never shorten this to `br`.
 *
 * `tailscale*` / `utun*` are excluded because `findTailscaleAddress` owns that
 * path — the overlap would be harmless, but excluding it stops a non-default
 * Tailscale setup from getting two listeners on one address.
 *
 * Considered and rejected: picking the default-route interface instead. That
 * needs platform-specific route parsing or spawning a process inside the bind
 * path — too much machinery for a security-sensitive code path.
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
 *
 * Range alone is NOT enough, and that was a real bug: Docker bridges, WireGuard
 * and OpenVPN tunnels, veth pairs and libvirt bridges all live in RFC1918, so an
 * address-only filter bound the daemon — which hands a shell to any credential
 * holder — to every container on `docker0`/`br-*`, a surface the user never
 * opted into (plus listener churn as bridges come and go). `DENIED_IFACE_PREFIXES`
 * above carries the filter and the deny-vs-allow reasoning.
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
 * The Bonjour name other LAN devices can resolve without any advertisement —
 * macOS publishes `<hostname>.local` natively, so the URL we surface prefers it
 * over a bare numeric address (which can change with DHCP). Appends `.local`
 * when the hostname lacks it; falls back to the first numeric address when the
 * hostname is unusable; returns null when there are no addresses at all.
 *
 * TRAP — this is a DISPLAY host, not a reachable one. The macOS-publishes-it
 * reasoning does not carry to a Linux daemon host: avahi answers `.local` with
 * AAAA records, the listeners here are IPv4-only (`findLanAddresses` filters to
 * `family === 'IPv4'`), and a peer that prefers IPv6 therefore resolves the name
 * and connects to nothing. Anything a *different* device must reach — above all
 * connecting clients — prefer `lanNumericUrl()` over the `.local` display name
 * when handing out a URL (mDNS can answer IPv6 while listeners are IPv4-only).
 */
export function lanDisplayHost(addresses: string[]): string | null {
  if (addresses.length === 0) return null
  const host = hostname()
  if (host !== '' && host !== 'localhost') {
    return host.endsWith('.local') ? host : `${host}.local`
  }
  return addresses[0] ?? null
}
