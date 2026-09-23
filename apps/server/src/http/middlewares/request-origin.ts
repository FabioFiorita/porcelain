import type { FastifyRequest } from 'fastify';
import {
  canonicalHostname,
  hostnameAllowed,
} from '../../models/origin-policy.ts';
import { ForbiddenOriginError } from '../errors/forbidden-origin-error.ts';

export type OriginPolicy = {
  allowedHosts: readonly string[];
};

const safeMethods = new Set(['GET', 'HEAD', 'OPTIONS']);
const defaultPorts: Record<string, string> = { http: '80', https: '443' };

type Authority = { hostname: string; port: string | undefined };

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
  if (colon >= 0 && value.indexOf(':') !== colon) return null;
  const raw = colon < 0 ? value : value.slice(0, colon);
  const port = colon < 0 ? undefined : value.slice(colon + 1);
  if (port !== undefined && !/^\d+$/.test(port)) return null;
  const hostname = canonicalHostname(raw);
  return hostname === null ? null : { hostname, port };
}

function requestAuthority(request: FastifyRequest): Authority | null {
  const header = request.headers.host;
  return header === undefined ? null : parseAuthority(header);
}

function effectivePort(scheme: string, port: string | undefined): string {
  return port ?? defaultPorts[scheme] ?? '';
}

export function checkRequestOrigin(
  policy: OriginPolicy,
  options: { requireSameOrigin?: boolean } = {},
) {
  return async (request: FastifyRequest) => {
    const authority = requestAuthority(request);
    if (authority === null)
      throw new ForbiddenOriginError('The Host header is missing or malformed');
    const local = request.socket.localAddress;
    if (
      !hostnameAllowed(authority.hostname, {
        allowedHosts: policy.allowedHosts,
        localAddresses: local === undefined ? [] : [local],
      })
    )
      throw new ForbiddenOriginError(
        `This server does not answer to the host ${authority.hostname}`,
      );
    if (safeMethods.has(request.method) && !options.requireSameOrigin) return;
    const origin = request.headers.origin;
    if (origin === undefined) {
      if (options.requireSameOrigin)
        throw new ForbiddenOriginError('The Origin header is required');
      return;
    }
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
