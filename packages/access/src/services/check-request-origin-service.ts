import type {
  CheckRequestOriginInput,
  CheckRequestOriginResult,
} from '../models/check-request-origin.ts';
import { canonicalHostname, hostnameAllowed } from '../rules/host-policy.ts';
import { effectivePort, requestAuthority } from '../rules/request-authority.ts';

const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

export class CheckRequestOriginService {
  execute(input: CheckRequestOriginInput): CheckRequestOriginResult {
    const authority =
      input.host === undefined ? undefined : requestAuthority(input.host);
    if (authority === undefined)
      return this.refused('The Host header is missing or malformed');
    const policy = {
      allowedHosts: input.allowedHosts,
      localAddresses:
        input.localAddress === undefined ? [] : [input.localAddress],
    };
    if (!hostnameAllowed(authority.hostname, policy))
      return this.refused(
        `This server does not answer to the host ${authority.hostname}`,
      );
    if (SAFE_METHODS.has(input.method) && !input.requireSameOrigin)
      return { kind: 'allowed' };
    if (input.origin === undefined)
      return input.requireSameOrigin
        ? this.refused('The Origin header is required')
        : { kind: 'allowed' };
    if (input.origin === 'null')
      return this.refused('An opaque origin cannot write');
    const origin = URL.parse(input.origin);
    if (!origin) return this.refused('The Origin header is malformed');
    const scheme = origin.protocol.replace(/:$/, '');
    const sameOrigin =
      scheme === input.scheme &&
      canonicalHostname(origin.hostname) === authority.hostname &&
      effectivePort(scheme, origin.port === '' ? undefined : origin.port) ===
        effectivePort(input.scheme, authority.port);
    return sameOrigin
      ? { kind: 'allowed' }
      : this.refused(`The origin ${input.origin} cannot write here`);
  }

  private refused(reason: string): CheckRequestOriginResult {
    return { kind: 'refused', reason };
  }
}
