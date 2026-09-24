import type { RequestAuthority } from '../models/request-authority.ts';
import { canonicalHostname } from './host-policy.ts';

const DEFAULT_PORTS: Record<string, string> = { http: '80', https: '443' };

export function requestAuthority(value: string): RequestAuthority | undefined {
  if (value.length === 0 || value.includes('\0')) return undefined;
  if (value.startsWith('[')) {
    const end = value.indexOf(']');
    if (end < 0) return undefined;
    const rest = value.slice(end + 1);
    if (rest !== '' && !/^:\d+$/.test(rest)) return undefined;
    const hostname = canonicalHostname(value.slice(1, end));
    return hostname === undefined
      ? undefined
      : { hostname, port: rest === '' ? undefined : rest.slice(1) };
  }
  const colon = value.lastIndexOf(':');
  if (colon >= 0 && value.indexOf(':') !== colon) return undefined;
  const port = colon < 0 ? undefined : value.slice(colon + 1);
  if (port !== undefined && !/^\d+$/.test(port)) return undefined;
  const hostname = canonicalHostname(colon < 0 ? value : value.slice(0, colon));
  return hostname === undefined ? undefined : { hostname, port };
}

export function effectivePort(
  scheme: string,
  port: string | undefined,
): string {
  return port ?? DEFAULT_PORTS[scheme] ?? '';
}
