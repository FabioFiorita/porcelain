import { isIP } from 'node:net';

/**
 * Which host names this server answers to.
 *
 * One rule, used twice: the request hook decides whether to serve a request,
 * and pairing decides whether a link may point somewhere. They disagreed once —
 * under `--lan` the door accepted the connection's LAN address while pairing
 * refused the same origin — and the owner met that as "the address my server
 * is on is not allowed".
 */
export type HostPolicy = {
  /** Names given explicitly on the command line. */
  allowedHosts: readonly string[];
  /** Addresses a connection can arrive on: the bound one, or all of them. */
  localAddresses: readonly string[];
};

/**
 * One spelling per address, so that `::1`, `0:0:0:0:0:0:0:1` and a trailing dot
 * on a name cannot slip past a textual comparison.
 */
export function canonicalHostname(value: string): string | null {
  if (value.length === 0) return null;
  // A URL's hostname keeps the brackets around an IPv6 literal; a Host header
  // is parsed without them. Compare one spelling.
  const lower = value
    .toLowerCase()
    .replace(/^\[|\]$/g, '')
    .replace(/\.$/, '');
  if (lower.length === 0) return null;
  // IPv4-mapped addresses arrive on dual-stack listeners as ::ffff:127.0.0.1,
  // and a URL normalises the same address to ::ffff:7f00:1. Both are that IPv4
  // address, and this must be decided before the general IPv6 form.
  const mapped = /^::ffff:(\d+\.\d+\.\d+\.\d+)$/.exec(lower);
  if (mapped?.[1]) return mapped[1];
  const hex = /^::ffff:([0-9a-f]{1,4}):([0-9a-f]{1,4})$/.exec(lower);
  if (hex?.[1] && hex[2]) {
    const high = Number.parseInt(hex[1], 16);
    const low = Number.parseInt(hex[2], 16);
    return [high >> 8, high & 0xff, low >> 8, low & 0xff].join('.');
  }
  if (isIP(lower) === 6) {
    try {
      return new URL(`http://[${lower}]`).hostname.replace(/^\[|\]$/g, '');
    } catch {
      return null;
    }
  }
  return lower;
}

function isLoopbackHostname(hostname: string): boolean {
  if (hostname === 'localhost') return true;
  if (hostname === '::1') return true;
  return isIP(hostname) === 4 && hostname.startsWith('127.');
}

/**
 * True when a request naming this host is ours to answer.
 *
 * Loopback is always an acceptable name here, because a connection that arrived
 * on a loopback address is this machine talking to itself. That is a different
 * question from whether a device elsewhere can reach us there, which is what
 * `reachableAt` answers — see the note on it.
 */
export function hostnameAllowed(hostname: string, policy: HostPolicy): boolean {
  if (isLoopbackHostname(hostname)) return true;
  const named = policy.allowedHosts
    .map((host) => canonicalHostname(host))
    .filter((host): host is string => host !== null);
  if (named.includes(hostname)) return true;
  // The addresses this server can be reached on cover the owner's LAN and
  // Tailscale addresses without allowing an arbitrary name to resolve here.
  return policy.localAddresses
    .map((address) => canonicalHostname(address))
    .some((address) => address !== null && address === hostname);
}

/**
 * True when a link pointing here would actually reach this server.
 *
 * Deliberately stricter than `hostnameAllowed`: a name being acceptable on a
 * connection that already arrived is not the same as a device being able to
 * open one. A server bound to IPv4 `0.0.0.0` answers nothing on `[::1]`, and a
 * link naming it is one the owner pastes into a device that cannot use it.
 * So loopback is not granted unconditionally — it has to be bound.
 */
export function reachableAt(hostname: string, policy: HostPolicy): boolean {
  const named = policy.allowedHosts
    .map((host) => canonicalHostname(host))
    .filter((host): host is string => host !== null);
  if (named.includes(hostname)) return true;
  const local = policy.localAddresses
    .map((address) => canonicalHostname(address))
    .filter((address): address is string => address !== null);
  if (local.includes(hostname)) return true;
  // `localhost` reaches whichever loopback address it resolves to, so it works
  // only when that address is one this server is listening on.
  return (
    hostname === 'localhost' &&
    local.some((address) => address === '127.0.0.1' || address === '::1')
  );
}
