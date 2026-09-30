import { net, protocol } from 'electron';
import { localNavigation } from './rules/navigation.ts';
import { desktopRequestOrigin } from './rules/request-origin.ts';

export const desktopAddress = 'porcelain://app';

export function registerDesktopScheme() {
  protocol.registerSchemesAsPrivileged([
    {
      scheme: 'porcelain',
      privileges: {
        standard: true,
        secure: true,
        supportFetchAPI: true,
        corsEnabled: true,
      },
    },
  ]);
}

export function serveDesktop(server: { address: string; credential: string }) {
  const lifetime = new AbortController();
  protocol.handle('porcelain', async (request) => {
    if (
      !localNavigation(request.url, desktopAddress) ||
      !desktopRequestOrigin(request.headers.get('origin'))
    )
      return new Response('Unknown desktop origin', { status: 403 });
    if (
      'initiatorOrigin' in request &&
      typeof request.initiatorOrigin === 'string' &&
      !desktopRequestOrigin(request.initiatorOrigin)
    )
      return new Response('Unknown desktop initiator', { status: 403 });
    const source = new URL(request.url);
    const target = new URL(
      `${source.pathname}${source.search}`,
      server.address,
    );
    if (target.origin !== new URL(server.address).origin)
      return new Response('Unknown server origin', { status: 403 });
    const headers = new Headers(request.headers);
    headers.delete('host');
    headers.delete('cookie');
    headers.delete('connection');
    headers.delete('content-length');
    headers.delete('accept-encoding');
    headers.set('authorization', `Bearer ${server.credential}`);
    headers.set('origin', new URL(server.address).origin);
    const response = await net
      .fetch(target.toString(), {
        method: request.method,
        headers,
        ...(request.method !== 'GET' && request.method !== 'HEAD'
          ? { body: await request.arrayBuffer() }
          : {}),
        redirect: 'manual',
        signal: AbortSignal.any([request.signal, lifetime.signal]),
      })
      .catch((error: unknown) => {
        if (lifetime.signal.aborted || request.signal.aborted)
          return new Response(null, { status: 503 });
        throw error;
      });
    const resultHeaders = new Headers(response.headers);
    resultHeaders.delete('set-cookie');
    resultHeaders.delete('content-encoding');
    resultHeaders.delete('content-length');
    if (!source.pathname.startsWith('/api/'))
      resultHeaders.set(
        'content-security-policy',
        `default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; font-src 'self' data:; connect-src 'self' ${server.address.replace('http:', 'ws:')}/api/live; frame-src 'self' blob:; worker-src 'self' blob:; object-src 'none'; base-uri 'self'`,
      );
    return new Response(response.body, {
      status: response.status,
      statusText: response.statusText,
      headers: resultHeaders,
    });
  });
  return () => {
    lifetime.abort();
    protocol.unhandle('porcelain');
  };
}
