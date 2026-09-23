import { isIP } from 'node:net';

export type HostPolicy = {
  allowedHosts: readonly string[];
  localAddresses: readonly string[];
};

export function canonicalHostname(value: string): string | null {
  if (value.length === 0) return null;
  const lower = value
    .toLowerCase()
    .replace(/^\[|\]$/g, '')
    .replace(/\.$/, '');
  if (lower.length === 0) return null;
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

export function hostnameAllowed(hostname: string, policy: HostPolicy): boolean {
  if (isLoopbackHostname(hostname)) return true;
  const named = policy.allowedHosts
    .map((host) => canonicalHostname(host))
    .filter((host): host is string => host !== null);
  if (named.includes(hostname)) return true;
  return policy.localAddresses
    .map((address) => canonicalHostname(address))
    .some((address) => address !== null && address === hostname);
}

export function reachableAt(hostname: string, policy: HostPolicy): boolean {
  const named = policy.allowedHosts
    .map((host) => canonicalHostname(host))
    .filter((host): host is string => host !== null);
  if (named.includes(hostname)) return true;
  const local = policy.localAddresses
    .map((address) => canonicalHostname(address))
    .filter((address): address is string => address !== null);
  if (local.includes(hostname)) return true;
  return (
    hostname === 'localhost' &&
    local.some((address) => address === '127.0.0.1' || address === '::1')
  );
}
