import type {
  CheckRequestOriginInput,
  CheckRequestOriginResult,
  RequestOriginRefusal,
} from '../models/check-request-origin.ts';
import { canonicalHostname, hostnameAllowed } from './host-policy.ts';
import { effectivePort, requestAuthority } from './request-authority.ts';

const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

function refused(refusal: RequestOriginRefusal): CheckRequestOriginResult {
  return { kind: 'refused', refusal };
}

export function requestOriginCheck(
  input: CheckRequestOriginInput,
): CheckRequestOriginResult {
  const authority =
    input.host === undefined ? undefined : requestAuthority(input.host);
  if (authority === undefined) return refused({ kind: 'host-malformed' });
  const policy = {
    allowedHosts: input.allowedHosts,
    localAddresses:
      input.localAddress === undefined ? [] : [input.localAddress],
  };
  if (!hostnameAllowed(authority.hostname, policy))
    return refused({ kind: 'host-not-allowed', hostname: authority.hostname });
  if (SAFE_METHODS.has(input.method) && !input.requireSameOrigin)
    return { kind: 'allowed' };
  if (input.origin === undefined)
    return input.requireSameOrigin
      ? refused({ kind: 'origin-required' })
      : { kind: 'allowed' };
  if (input.origin === 'null') return refused({ kind: 'origin-opaque' });
  const origin = URL.parse(input.origin);
  if (!origin) return refused({ kind: 'origin-malformed' });
  const scheme = origin.protocol.replace(/:$/, '');
  const sameOrigin =
    scheme === input.scheme &&
    canonicalHostname(origin.hostname) === authority.hostname &&
    effectivePort(scheme, origin.port === '' ? undefined : origin.port) ===
      effectivePort(input.scheme, authority.port);
  return sameOrigin
    ? { kind: 'allowed' }
    : refused({ kind: 'cross-origin', origin: input.origin });
}
