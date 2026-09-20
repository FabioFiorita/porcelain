import { isIP } from 'node:net';
import type { FastifyRequest } from 'fastify';
import { ForbiddenOriginError } from '../errors/forbidden-origin-error.ts';

/**
 * The named threat is a page in the owner's own browser reaching this server:
 * DNS rebinding puts an attacker's name in `Host`, and a cross-site form or
 * fetch puts a foreign `Origin` on a write.  Nothing here reads `X-Forwarded-*`
 * — a reverse proxy needs an explicit trusted-proxy and public-origin contract,
 * which does not exist yet, and half-trusting a header a client can send would
 * hand the attacker both checks.
 */
export type OriginPolicy = {
  /** Host names given explicitly on the command line. */
  allowedHosts: readonly string[];
};

const safeMethods = new Set(['GET', 'HEAD', 'OPTIONS']);
const defaultPorts: Record<string, string> = { http: '80', https: '443' };

type Authority = { hostname: string; port: string | undefined };

/** Split `host:port`, keeping bracketed IPv6 literals intact. */
function parseAuthority(value: string): Authority | null {
  if (value.length === 0 || value.includes('\0')) return null;
  if (value.startsWith('[')) {
    const end = value.indexOf(']');
    if (end < 0) return null;
    const rest = value.slice(end + 1);
    if (rest !== '' && !/^:\d+$/.test(rest)) return null;
    const hostname = canonicalHostname(value.slice(1, end));
    return hostname === null
      ? null
      : { hostname, port: rest === '' ? undefined : rest.slice(1) };
  }
  const colon = value.lastIndexOf(':');
  // A bare IPv6 literal has several colons and is only legal in brackets.
  if (colon >= 0 && value.indexOf(':') !== colon) return null;
  const raw = colon < 0 ? value : value.slice(0, colon);
  const port = colon < 0 ? undefined : value.slice(colon + 1);
  if (port !== undefined && !/^\d+$/.test(port)) return null;
  const hostname = canonicalHostname(raw);
  return hostname === null ? null : { hostname, port };
}

/**
 * One spelling per address, so that `::1`, `0:0:0:0:0:0:0:1` and a trailing dot
 * on a name cannot slip past a textual comparison.
 */
function canonicalHostname(value: string): string | null {
  if (value.length === 0) return null;
  // A URL's hostname keeps the brackets around an IPv6 literal; a Host header
  // is parsed without them. Compare one spelling.
  const lower = value
    .toLowerCase()
    .replace(/^\[|\]$/g, '')
    .replace(/\.$/, '');
  if (lower.length === 0) return null;
  // IPv4-mapped addresses arrive on dual-stack listeners as ::ffff:127.0.0.1;
  // this must be decided before the general IPv6 form.
  const mapped = /^::ffff:(\d+\.\d+\.\d+\.\d+)$/.exec(lower);
  if (mapped?.[1]) return mapped[1];
  if (isIP(lower) === 6) {
    try {
      return new URL(`http://[${lower}]`).hostname.replace(/^\[|\]$/g, '');
    } catch {
      return null;
    }
  }
  return lower;
}

function isLoopback(hostname: string): boolean {
  if (hostname === 'localhost') return true;
  if (hostname === '::1') return true;
  return isIP(hostname) === 4 && hostname.startsWith('127.');
}

function requestAuthority(request: FastifyRequest): Authority | null {
  const header = request.headers.host;
  return header === undefined ? null : parseAuthority(header);
}

function effectivePort(scheme: string, port: string | undefined): string {
  return port ?? defaultPorts[scheme] ?? '';
}

function hostAllowed(
  hostname: string,
  request: FastifyRequest,
  allowed: ReadonlySet<string>,
): boolean {
  if (isLoopback(hostname)) return true;
  if (allowed.has(hostname)) return true;
  // The address the connection actually arrived on covers the owner's LAN and
  // Tailscale addresses without allowing arbitrary names to resolve here.
  const local = request.socket.localAddress;
  const canonical = local === undefined ? null : canonicalHostname(local);
  return canonical !== null && canonical === hostname;
}

export function checkRequestOrigin(policy: OriginPolicy) {
  const allowed = new Set(
    policy.allowedHosts
      .map((host) => canonicalHostname(host))
      .filter((host): host is string => host !== null),
  );
  return async (request: FastifyRequest) => {
    const authority = requestAuthority(request);
    if (authority === null)
      throw new ForbiddenOriginError('The Host header is missing or malformed');
    if (!hostAllowed(authority.hostname, request, allowed))
      throw new ForbiddenOriginError(
        `This server does not answer to the host ${authority.hostname}`,
      );
    if (safeMethods.has(request.method)) return;
    const origin = request.headers.origin;
    // A client that sends no Origin is not a browser acting for another site.
    if (origin === undefined) return;
    if (origin === 'null')
      throw new ForbiddenOriginError('An opaque origin cannot write');
    let parsed: URL;
    try {
      parsed = new URL(origin);
    } catch {
      throw new ForbiddenOriginError('The Origin header is malformed');
    }
    const scheme = parsed.protocol.replace(/:$/, '');
    const sameOrigin =
      scheme === request.protocol &&
      canonicalHostname(parsed.hostname) === authority.hostname &&
      effectivePort(scheme, parsed.port === '' ? undefined : parsed.port) ===
        effectivePort(request.protocol, authority.port);
    if (!sameOrigin)
      throw new ForbiddenOriginError(`The origin ${origin} cannot write here`);
  };
}
