import type { CheckLocalRequestInput } from '../models/check-local-request.ts';
import type { RequestAuthority } from '../models/request-authority.ts';
import { canonicalHostname, isLoopbackHostname } from './host-policy.ts';
import { effectivePort, requestAuthority } from './request-authority.ts';

const FORWARDING_HEADERS = new Set([
  'forwarded',
  'x-forwarded-for',
  'x-forwarded-host',
  'x-real-ip',
  'cf-connecting-ip',
  'true-client-ip',
]);

const SAME_ORIGIN_FETCH = 'same-origin';

function loopbackAddress(address: string | undefined): boolean {
  const hostname =
    address === undefined ? undefined : canonicalHostname(address);
  return hostname !== undefined && isLoopbackHostname(hostname);
}

function pageOfThisListener(
  address: string | undefined,
  authority: RequestAuthority,
): boolean {
  if (address === undefined) return true;
  const page = URL.parse(address);
  if (!page) return false;
  return (
    page.protocol === 'http:' &&
    canonicalHostname(page.hostname) === authority.hostname &&
    effectivePort('http', page.port === '' ? undefined : page.port) ===
      effectivePort('http', authority.port)
  );
}

function browserAskedFromHere(
  input: CheckLocalRequestInput,
  authority: RequestAuthority,
): boolean {
  return (
    pageOfThisListener(input.origin, authority) &&
    pageOfThisListener(input.referer, authority) &&
    (input.fetchSite === undefined || input.fetchSite === SAME_ORIGIN_FETCH)
  );
}

export function localRequest(input: CheckLocalRequestInput): boolean {
  const authority =
    input.host === undefined ? undefined : requestAuthority(input.host);
  return (
    authority !== undefined &&
    isLoopbackHostname(authority.hostname) &&
    loopbackAddress(input.remoteAddress) &&
    loopbackAddress(input.localAddress) &&
    !input.headers.some((name) => FORWARDING_HEADERS.has(name.toLowerCase())) &&
    browserAskedFromHere(input, authority)
  );
}
