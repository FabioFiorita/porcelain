import { apiErrorSchema } from '@porcelain/contracts/shared';
import {
  Cause,
  Effect,
  Exit,
  Layer,
  Result,
  Schema,
  type Context,
} from 'effect';
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
import { withSignal } from '@porcelain/effects';

export function transportLayer(transport: Transport) {
  const send: Context.Service.Shape<typeof FetchHttpClient.Fetch> = (
    input,
    init,
  ) => {
    const url = new URL(
      typeof input === 'string'
        ? input
        : input instanceof URL
          ? input.href
          : input.url,
    );
    return transport(`${url.pathname}${url.search}`, init);
  };
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
      FetchHttpClient.layer.pipe(
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

export function requestEffect<A, E, R>(
  request: Effect.Effect<A, E, R>,
  signal?: AbortSignal | WorktreeConnection['request'],
): Effect.Effect<A, E | ConnectionError | RequestError, R> {
  const checked = Effect.catch(
    request,
    (error): Effect.Effect<never, E | ConnectionError | RequestError> =>
      HttpClientError.isHttpClientError(error)
        ? Effect.flatMap(unansweredRequest(error), Effect.fail)
        : Effect.fail(error),
  );
  return Effect.suspend(() => {
    const current = typeof signal === 'function' ? signal().signal : signal;
    return current ? withSignal(checked, current) : checked;
  });
}

async function settleRequest<A, E>(
  signal: AbortSignal,
  execute: () => Promise<Exit.Exit<A, E>>,
): Promise<A> {
  signal.throwIfAborted();
  const exit = await execute();
  signal.throwIfAborted();
  if (Exit.isSuccess(exit)) return exit.value;
  throw Cause.squash(exit.cause);
}

export function runRequest<A, E>(
  request: Effect.Effect<A, E>,
  signal: AbortSignal,
): Promise<A> {
  return settleRequest(signal, () =>
    Effect.runPromiseExit(requestEffect(request), { signal }),
  );
}
