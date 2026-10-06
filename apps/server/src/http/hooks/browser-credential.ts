import { Effect } from 'effect';
import { HttpServerResponse } from 'effect/http';
import { RequestContext } from '../request-context.ts';
import { RequestError } from '../../runtime/errors/request-error.ts';
import { clearDeviceCookie, setDeviceCookie } from './device-cookie.ts';

const BROWSER_HEADER = 'x-porcelain-browser';
export function deliverBrowserCredential(
  cookie: { cookieMaxAgeSeconds: number },
  response: HttpServerResponse.HttpServerResponse,
) {
  return Effect.gen(function* () {
    const context = yield* RequestContext;
    if (
      context.request.headers[BROWSER_HEADER] !== '1' ||
      context.crossOrigin ||
      response.body._tag !== 'Uint8Array'
    )
      return response;
    const payload: unknown = JSON.parse(
      new TextDecoder().decode(response.body.body),
    );
    if (
      typeof payload !== 'object' ||
      payload === null ||
      !('credential' in payload) ||
      typeof payload.credential !== 'string'
    )
      return response;
    const { credential, ...rest } = payload;
    setDeviceCookie(
      context,
      credential,
      context.client.secure,
      cookie.cookieMaxAgeSeconds,
    );
    return HttpServerResponse.jsonUnsafe(rest, {
      status: response.status,
      headers: response.headers,
    });
  });
}
export const requireBrowserRequest = Effect.gen(function* () {
  const context = yield* RequestContext;
  if (context.request.headers[BROWSER_HEADER] !== '1')
    return yield* Effect.die(
      new RequestError({
        statusCode: 403,
        message: 'Browser request header required',
      }),
    );
});
export const clearBrowserCredential = Effect.gen(function* () {
  clearDeviceCookie(yield* RequestContext);
});
