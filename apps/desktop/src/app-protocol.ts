import { net, protocol } from 'electron';
import {
  appRequestRefusal,
  appRequestTarget,
  forwardedRequestHeaders,
  forwardedResponseHeaders,
} from './rules/app-request.ts';

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
    const refusal = appRequestRefusal({
      url: request.url,
      origin: request.headers.get('origin'),
      initiatorOrigin:
        'initiatorOrigin' in request &&
        typeof request.initiatorOrigin === 'string'
          ? request.initiatorOrigin
          : undefined,
    });
    if (refusal !== undefined) return new Response(refusal, { status: 403 });
    const target = appRequestTarget(request.url, server.address);
    if (target === undefined)
      return new Response('Unknown server origin', { status: 403 });
    const response = await net
      .fetch(target, {
        method: request.method,
        headers: forwardedRequestHeaders(request.headers, server),
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
    return new Response(response.body, {
      status: response.status,
      statusText: response.statusText,
      headers: forwardedResponseHeaders(
        new URL(request.url).pathname,
        response.headers,
      ),
    });
  });
  return () => {
    lifetime.abort();
    protocol.unhandle('porcelain');
  };
}
