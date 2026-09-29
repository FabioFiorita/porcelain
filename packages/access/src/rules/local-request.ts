import type { CheckLocalRequestInput } from '../models/check-local-request.ts';
import { canonicalHostname, isLoopbackHostname } from './host-policy.ts';
import { requestAuthority } from './request-authority.ts';

const FORWARDING_HEADERS = new Set([
  'forwarded',
  'x-forwarded-for',
  'x-forwarded-host',
  'x-real-ip',
  'cf-connecting-ip',
  'true-client-ip',
]);

function loopbackAddress(address: string | undefined): boolean {
  const hostname =
    address === undefined ? undefined : canonicalHostname(address);
  return hostname !== undefined && isLoopbackHostname(hostname);
}

export function localRequest(input: CheckLocalRequestInput): boolean {
  const authority =
    input.host === undefined ? undefined : requestAuthority(input.host);
  return (
    authority !== undefined &&
    isLoopbackHostname(authority.hostname) &&
    loopbackAddress(input.remoteAddress) &&
    loopbackAddress(input.localAddress) &&
    !input.headers.some((name) => FORWARDING_HEADERS.has(name.toLowerCase()))
  );
}
