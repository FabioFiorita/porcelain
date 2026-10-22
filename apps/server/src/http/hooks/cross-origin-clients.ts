import { Effect } from 'effect';
import { HttpRouter, HttpServerResponse } from 'effect/http';
import { RequestError } from '../../runtime/errors/request-error.ts';
import { RequestContext } from '../request-context.ts';
import { bearerCredential } from './authenticate.ts';

const PAIRING_PATH = '/api/pair';
const HEALTH_PATH = '/api/health';
const HEALTH_METHODS = new Set(['GET', 'HEAD']);
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
    const healthPreflight =
      path === HEALTH_PATH &&
      HEALTH_METHODS.has(
        request.headers['access-control-request-method'] ?? '',
      );
    const anonymousHealthPreflight =
      healthPreflight &&
      !bearerPreflight &&
      bearerCredential(context) === undefined;
    const allowed =
      healthPreflight ||
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
        'Access-Control-Allow-Methods': anonymousHealthPreflight
          ? 'GET, HEAD'
          : 'GET, HEAD, POST, PUT, PATCH, DELETE',
        'Access-Control-Allow-Headers': anonymousHealthPreflight
          ? 'content-type'
          : 'authorization, content-type',
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
    const { route } = yield* HttpRouter.RouteContext;
    const path = context.request.originalUrl.split('?', 1)[0] ?? '';
    return path.startsWith('/api/') &&
      ((path === HEALTH_PATH && HEALTH_METHODS.has(context.request.method)) ||
        (path === PAIRING_PATH &&
          PAIRING_METHODS.has(context.request.method)) ||
        (bearerCredential(context) !== undefined &&
          (route.path !== '/api/environment' ||
            context.principal?.kind === 'device')))
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
