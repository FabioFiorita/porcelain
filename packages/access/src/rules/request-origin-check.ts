import type {
  CheckRequestOriginInput,
  CheckRequestOriginResult,
  RequestOriginRefusal,
} from '../models/check-request-origin.ts';
import type { RequestAuthority } from '../models/request-authority.ts';
import { canonicalHostname, hostnameAllowed } from './host-policy.ts';
import { effectivePort, requestAuthority } from './request-authority.ts';

const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

function refused(refusal: RequestOriginRefusal): CheckRequestOriginResult {
  return { kind: 'refused', refusal };
}

function originRefusal(
  input: CheckRequestOriginInput,
  authority: RequestAuthority,
  requestScheme: string,
): RequestOriginRefusal | undefined {
  if (input.origin === undefined)
    return input.requireSameOrigin ? { kind: 'origin-required' } : undefined;
  if (input.origin === 'null') return { kind: 'origin-opaque' };
  const origin = URL.parse(input.origin);
  if (!origin) return { kind: 'origin-malformed' };
  const scheme = origin.protocol.replace(/:$/, '');
  const sameOrigin =
    scheme === requestScheme &&
    canonicalHostname(origin.hostname) === authority.hostname &&
    effectivePort(scheme, origin.port === '' ? undefined : origin.port) ===
      effectivePort(requestScheme, authority.port);
  return sameOrigin
    ? undefined
    : { kind: 'cross-origin', origin: input.origin };
}

function crossOriginAllowed(input: CheckRequestOriginInput): boolean {
  switch (input.crossOrigin) {
    case 'refused':
      return false;
    case 'bearer':
      return input.credential === 'bearer';
    case 'anyone':
      return true;
  }
}

export function requestOriginCheck(
  input: CheckRequestOriginInput,
  httpsHosts: readonly string[] = [],
): CheckRequestOriginResult {
  const authority =
    input.host === undefined ? undefined : requestAuthority(input.host);
  if (authority === undefined) return refused({ kind: 'host-malformed' });
  const proxied = httpsHosts.includes(authority.hostname);
  const policy = {
    allowedHosts: [...input.allowedHosts, ...httpsHosts],
    localAddresses:
      input.localAddress === undefined ? [] : [input.localAddress],
  };
  if (!hostnameAllowed(authority.hostname, policy))
    return refused({ kind: 'host-not-allowed', hostname: authority.hostname });
  const refusal = originRefusal(
    input,
    authority,
    proxied ? 'https' : input.scheme,
  );
  if (refusal === undefined) return { kind: 'allowed', crossOrigin: false };
  const crossOrigin = refusal.kind !== 'origin-required';
  if (crossOriginAllowed(input)) return { kind: 'allowed', crossOrigin };
  if (SAFE_METHODS.has(input.method) && !input.requireSameOrigin)
    return { kind: 'allowed', crossOrigin };
  return refused(refusal);
}
