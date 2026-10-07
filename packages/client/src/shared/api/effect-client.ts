import { apiErrorSchema } from '@porcelain/contracts/shared';
import { Effect, Layer, Result, Schema, type Context } from 'effect';
import {
  HttpClient,
  HttpClientError,
  FetchHttpClient,
  HttpClientRequest,
} from 'effect/http';
import { ConnectionError } from './connection-error.ts';
import { RequestError } from './request-error.ts';
import type { WorktreeConnection } from './connection.ts';
import type { Transport } from './transport.ts';

export function transportLayer(transport: Transport) {
  const send: Context.Service.Shape<typeof FetchHttpClient.Fetch> = (
    url,
    init,
  ) =>
    url instanceof URL
      ? transport(`${url.pathname}${url.search}`, init)
      : Promise.reject(
          new TypeError('FetchHttpClient sends every request as a parsed URL.'),
        );
  return Layer.effect(
    HttpClient.HttpClient,
    Effect.map(HttpClient.HttpClient, (client) =>
      client.pipe(
        HttpClient.mapRequest(
          HttpClientRequest.prependUrl('http://porcelain.invalid'),
        ),
        HttpClient.transformResponse(
          Effect.provideService(HttpClient.TracerPropagationEnabled, false),
        ),
      ),
    ),
  ).pipe(
    Layer.provide(
      Layer.fresh(FetchHttpClient.layer).pipe(
        Layer.provide(
          Layer.merge(
            Layer.succeed(FetchHttpClient.Fetch, send),
            Layer.succeed(FetchHttpClient.RequestInit, {
              redirect: 'error',
              cache: 'no-store',
            }),
          ),
        ),
      ),
    ),
  );
}

function unansweredRequest(
  error: HttpClientError.HttpClientError,
): Effect.Effect<ConnectionError | RequestError> {
  const response = error.response;
  if (response === undefined)
    return Effect.succeed(
      new ConnectionError({
        message: 'Could not reach Porcelain. Try again.',
        cause:
          error.reason._tag === 'TransportError' ? error.reason.cause : error,
      }),
    );
  return Effect.map(
    Effect.orElseSucceed(response.json, () => undefined),
    (body: unknown) => {
      const parsed = Schema.decodeUnknownResult(apiErrorSchema)(body);
      return new RequestError({
        status: response.status,
        message: Result.isSuccess(parsed)
          ? parsed.success.message
          : `Request failed (${response.status})`,
        code: undefined,
      });
    },
  );
}

export function mapRequestErrors<A, E, R>(
  request: Effect.Effect<A, E, R>,
): Effect.Effect<A, E | ConnectionError | RequestError, R> {
  return Effect.catch(
    request,
    (error): Effect.Effect<never, E | ConnectionError | RequestError> =>
      HttpClientError.isHttpClientError(error)
        ? Effect.flatMap(unansweredRequest(error), Effect.fail)
        : Effect.fail(error),
  );
}

export function requestEffect<A, E, R>(
  request: Effect.Effect<A, E, R>,
  lifetime: WorktreeConnection['request'],
): Effect.Effect<A, E | ConnectionError | RequestError, R> {
  return lifetime(mapRequestErrors(request));
}
