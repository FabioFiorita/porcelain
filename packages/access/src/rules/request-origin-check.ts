import type {
  CheckRequestOriginInput,
  CheckRequestOriginResult,
} from '../models/check-request-origin.ts';
import { canonicalHostname, hostnameAllowed } from './host-policy.ts';
import { effectivePort, requestAuthority } from './request-authority.ts';

const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

function refused(reason: string): CheckRequestOriginResult {
  return { kind: 'refused', reason };
}

export function requestOriginCheck(
  input: CheckRequestOriginInput,
): CheckRequestOriginResult {
  const authority =
    input.host === undefined ? undefined : requestAuthority(input.host);
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
  if (SAFE_METHODS.has(input.method) && !input.requireSameOrigin)
    return { kind: 'allowed' };
  if (input.origin === undefined)
    return input.requireSameOrigin
      ? refused('The Origin header is required')
      : { kind: 'allowed' };
  if (input.origin === 'null') return refused('An opaque origin cannot write');
  const origin = URL.parse(input.origin);
  if (!origin) return refused('The Origin header is malformed');
  const scheme = origin.protocol.replace(/:$/, '');
  const sameOrigin =
    scheme === input.scheme &&
    canonicalHostname(origin.hostname) === authority.hostname &&
    effectivePort(scheme, origin.port === '' ? undefined : origin.port) ===
      effectivePort(input.scheme, authority.port);
  return sameOrigin
    ? { kind: 'allowed' }
    : refused(`The origin ${input.origin} cannot write here`);
}
