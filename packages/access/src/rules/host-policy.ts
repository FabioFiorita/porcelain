import type { HostPolicy } from '../models/host-policy.ts';
import type { PairingReach } from '../models/pairing-reach.ts';

const IPV4 =
  /^(?:(?:25[0-5]|2[0-4]\d|1\d\d|[1-9]\d|\d)\.){3}(?:25[0-5]|2[0-4]\d|1\d\d|[1-9]\d|\d)$/;

const MAPPED_HEX =
  /^::ffff:([0-9a-f]{0,2}?)([0-9a-f]{1,2}):([0-9a-f]{0,2}?)([0-9a-f]{1,2})$/;

function hexByte(digits: string | undefined): number {
  return digits ? Number(`0x${digits}`) : 0;
}

function normalizedIpv6(value: string): string | undefined {
  return URL.parse(`http://[${value}]`)?.hostname.replace(/^\[|\]$/g, '');
}

export function canonicalHostname(value: string): string | undefined {
  const lower = value
    .toLowerCase()
    .replace(/^\[|\]$/g, '')
    .replace(/\.$/, '');
  if (lower.length === 0) return undefined;
  const mapped = /^::ffff:(\d+\.\d+\.\d+\.\d+)$/.exec(lower);
  if (mapped?.[1]) return mapped[1];
  const hex = MAPPED_HEX.exec(lower);
  if (hex) return hex.slice(1).map(hexByte).join('.');
  if (lower.includes(':')) return normalizedIpv6(lower);
  return lower;
}

function canonicalList(values: readonly string[]): string[] {
  return values
    .map((value) => canonicalHostname(value))
    .filter((value): value is string => value !== undefined);
}

function isLoopbackHostname(hostname: string): boolean {
  if (hostname === 'localhost' || hostname === '::1') return true;
  return IPV4.test(hostname) && hostname.startsWith('127.');
}

export function hostnameAllowed(hostname: string, policy: HostPolicy): boolean {
  if (isLoopbackHostname(hostname)) return true;
  if (canonicalList(policy.allowedHosts).includes(hostname)) return true;
  return canonicalList(policy.localAddresses).includes(hostname);
}

export function reachableAt(hostname: string, policy: HostPolicy): boolean {
  if (canonicalList(policy.allowedHosts).includes(hostname)) return true;
  const local = canonicalList(policy.localAddresses);
  if (local.includes(hostname)) return true;
  return (
    hostname === 'localhost' &&
    local.some((address) => address === '127.0.0.1' || address === '::1')
  );
}

export function pairingAddressReachable(
  address: string,
  reach: PairingReach,
): boolean {
  const url = URL.parse(address);
  if (!url) return false;
  if (url.protocol !== 'http:' && url.protocol !== 'https:') return false;
  const defaultPort = url.protocol === 'http:' ? '80' : '443';
  if ((url.port || defaultPort) !== String(reach.port)) return false;
  const hostname = canonicalHostname(url.hostname);
  return hostname !== undefined && reachableAt(hostname, reach.policy);
}
