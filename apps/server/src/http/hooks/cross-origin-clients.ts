import { Effect } from 'effect';
import { HttpRouter, HttpServerResponse } from 'effect/http';
import { RequestError } from '../../runtime/errors/request-error.ts';
import { RequestContext } from '../request-context.ts';
import { bearerCredential } from './authenticate.ts';

const PAIRING_PATH = '/api/pair';
const PAIRING_METHODS = new Set(['POST', 'OPTIONS']);
function crossOriginClients(options: { maxAgeSeconds: number }) {
  return Effect.gen(function* () {
    const context = yield* RequestContext;
    const request = context.request;
    const path = request.originalUrl.split('?', 1)[0] ?? '';
    const requested = request.headers['access-control-request-headers'];
    const bearerPreflight =
      requested
        ?.split(',')
        .some((header) => header.trim().toLowerCase() === 'authorization') ??
      false;
    const allowed =
      (path === PAIRING_PATH && PAIRING_METHODS.has(request.method)) ||
      (request.method === 'OPTIONS'
        ? bearerPreflight
        : bearerCredential(context) !== undefined);
    if (!allowed)
      return yield* Effect.die(
        new RequestError({
          statusCode: 404,
          message: `Route OPTIONS:${path} not found`,
        }),
      );
    return HttpServerResponse.empty({
      status: 204,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, HEAD, POST, PUT, PATCH, DELETE',
        'Access-Control-Allow-Headers': 'authorization, content-type',
        'Access-Control-Max-Age': String(options.maxAgeSeconds),
      },
    });
  });
}

export function crossOriginHeaders(
  response: HttpServerResponse.HttpServerResponse,
) {
  return Effect.gen(function* () {
    const context = yield* RequestContext;
    const path = context.request.originalUrl.split('?', 1)[0] ?? '';
    return path.startsWith('/api/') &&
      ((path === PAIRING_PATH && PAIRING_METHODS.has(context.request.method)) ||
        bearerCredential(context) !== undefined)
      ? HttpServerResponse.setHeader(
          response,
          'Access-Control-Allow-Origin',
          '*',
        )
      : response;
  });
}

export function corsPreflight(options: { maxAgeSeconds: number }) {
  return HttpRouter.add('OPTIONS', '/api/*', crossOriginClients(options));
}
