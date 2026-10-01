import {
  desktopResponseContentSecurityPolicy,
  type DesktopWeb,
} from './content-security-policy.ts';
import { desktopAddress, localNavigation } from './navigation.ts';
import { desktopRequestOrigin } from './request-origin.ts';

const withheldRequestHeaders = [
  'host',
  'cookie',
  'connection',
  'content-length',
  'accept-encoding',
];
const withheldResponseHeaders = [
  'set-cookie',
  'content-encoding',
  'content-length',
];

export function appRequestRefusal(request: {
  url: string;
  origin: string | null;
  initiatorOrigin: string | undefined;
}): string | undefined {
  if (
    !localNavigation(request.url, desktopAddress) ||
    !desktopRequestOrigin(request.origin)
  )
    return 'Unknown desktop origin';
  if (
    request.initiatorOrigin !== undefined &&
    !desktopRequestOrigin(request.initiatorOrigin)
  )
    return 'Unknown desktop initiator';
  return undefined;
}

export function appRequestTarget(
  url: string,
  server: string,
): string | undefined {
  const source = new URL(url);
  const target = new URL(`${source.pathname}${source.search}`, server);
  return target.origin === new URL(server).origin ? target.href : undefined;
}

export function forwardedRequestHeaders(
  headers: Headers,
  server: { address: string; credential: string },
): Headers {
  const forwarded = new Headers(headers);
  for (const name of withheldRequestHeaders) forwarded.delete(name);
  forwarded.set('authorization', `Bearer ${server.credential}`);
  forwarded.set('origin', new URL(server.address).origin);
  return forwarded;
}

export function developmentWebPath(pathname: string): boolean {
  return !/^\/(?:api|review-summaries)(?:\/|$)/.test(pathname);
}

export function forwardedWebRequestHeaders(headers: Headers): Headers {
  const forwarded = new Headers(headers);
  for (const name of [...withheldRequestHeaders, 'authorization', 'origin'])
    forwarded.delete(name);
  return forwarded;
}

export function forwardedResponseHeaders(
  pathname: string,
  headers: Headers,
  web: DesktopWeb,
): Headers {
  const forwarded = new Headers(headers);
  for (const name of withheldResponseHeaders) forwarded.delete(name);
  if (!pathname.startsWith('/api/'))
    forwarded.set(
      'content-security-policy',
      desktopResponseContentSecurityPolicy(
        pathname,
        forwarded.get('content-security-policy'),
        web,
      ),
    );
  return forwarded;
}
