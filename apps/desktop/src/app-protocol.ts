import { net, protocol } from 'electron';
import {
  appRequestRefusal,
  appRequestTarget,
  developmentWebPath,
  forwardedRequestHeaders,
  forwardedResponseHeaders,
  forwardedWebRequestHeaders,
} from './rules/app-request.ts';
import {
  remoteSummaryHeaders,
  remoteSummaryRequest,
  remoteSummaryTarget,
} from './rules/remote-summary.ts';

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

async function remoteSummary(
  request: Request,
  signal: AbortSignal,
): Promise<Response> {
  const target = remoteSummaryTarget(request.url);
  if (request.method !== 'GET' || target === undefined)
    return new Response('Unknown review summary', { status: 404 });
  const response = await net
    .fetch(target, { credentials: 'omit', redirect: 'manual', signal })
    .catch(
      () =>
        new Response(
          'The computer that published this summary is unreachable',
          {
            status: 502,
          },
        ),
    );
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers: remoteSummaryHeaders(response.headers),
  });
}

export function serveDesktop(
  server: { address: string; credential: string },
  development: string | undefined,
) {
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
    const signal = AbortSignal.any([request.signal, lifetime.signal]);
    const pathname = new URL(request.url).pathname;
    if (remoteSummaryRequest(pathname)) return remoteSummary(request, signal);
    const web =
      development !== undefined && developmentWebPath(pathname)
        ? development
        : undefined;
    const target = appRequestTarget(request.url, web ?? server.address);
    if (target === undefined)
      return new Response('Unknown server origin', { status: 403 });
    const response = await net
      .fetch(target, {
        method: request.method,
        headers:
          web === undefined
            ? forwardedRequestHeaders(request.headers, server)
            : forwardedWebRequestHeaders(request.headers),
        ...(request.method !== 'GET' && request.method !== 'HEAD'
          ? { body: await request.arrayBuffer() }
          : {}),
        redirect: 'manual',
        signal,
      })
      .catch((error: unknown) => {
        if (signal.aborted) return new Response(null, { status: 503 });
        throw error;
      });
    return new Response(response.body, {
      status: response.status,
      statusText: response.statusText,
      headers: forwardedResponseHeaders(
        pathname,
        response.headers,
        development === undefined ? 'built' : 'development',
      ),
    });
  });
  return () => {
    lifetime.abort();
    protocol.unhandle('porcelain');
  };
}
