import type {
  CheckRequestOriginInput,
  CheckRequestOriginResult,
} from '../models/check-request-origin.ts';
import { canonicalHostname, hostnameAllowed } from '../rules/host-policy.ts';

type Authority = { hostname: string; port: string | undefined };

const safeMethods = new Set(['GET', 'HEAD', 'OPTIONS']);
const defaultPorts: Record<string, string> = { http: '80', https: '443' };

function parseAuthority(value: string): Authority | undefined {
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

function effectivePort(scheme: string, port: string | undefined): string {
  return port ?? defaultPorts[scheme] ?? '';
}

function refused(reason: string): CheckRequestOriginResult {
  return { allowed: false, reason };
}

export class CheckRequestOriginService {
  execute(input: CheckRequestOriginInput): CheckRequestOriginResult {
    const authority =
      input.host === undefined ? undefined : parseAuthority(input.host);
    if (authority === undefined)
      return refused('The Host header is missing or malformed');
    const policy = {
      allowedHosts: input.allowedHosts,
      localAddresses:
        input.localAddress === undefined ? [] : [input.localAddress],
    };
    if (!hostnameAllowed(authority.hostname, policy))
      return refused(
        `This server does not answer to the host ${authority.hostname}`,
      );
    if (safeMethods.has(input.method) && !input.requireSameOrigin)
      return { allowed: true };
    if (input.origin === undefined)
      return input.requireSameOrigin
        ? refused('The Origin header is required')
        : { allowed: true };
    if (input.origin === 'null')
      return refused('An opaque origin cannot write');
    if (!URL.canParse(input.origin))
      return refused('The Origin header is malformed');
    const origin = new URL(input.origin);
    const scheme = origin.protocol.replace(/:$/, '');
    const sameOrigin =
      scheme === input.scheme &&
      canonicalHostname(origin.hostname) === authority.hostname &&
      effectivePort(scheme, origin.port === '' ? undefined : origin.port) ===
        effectivePort(input.scheme, authority.port);
    return sameOrigin
      ? { allowed: true }
      : refused(`The origin ${input.origin} cannot write here`);
  }
}
