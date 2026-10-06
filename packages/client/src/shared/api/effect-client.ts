import { apiErrorSchema } from '@porcelain/contracts/shared';
import { Cause, Effect, Exit, Result, Schema } from 'effect';
import {
  HttpClient,
  HttpClientError,
  HttpClientResponse,
  HttpClientRequest,
} from 'effect/http';
import { ConnectionError } from './connection-error.ts';
import { RequestError } from './request-error.ts';
import type { Transport } from './transport.ts';
import { withSignal } from '@porcelain/effects';

function bodyOf(request: HttpClientRequest.HttpClientRequest): RequestInit {
  return request.body._tag === 'Uint8Array'
    ? { body: new Uint8Array(request.body.body) }
    : {};
}

export function transportClient(transport: Transport) {
  const sent = HttpClient.make((request, url, signal) =>
    Effect.map(
      Effect.tryPromise({
        try: () =>
          transport(`${url.pathname}${url.search}`, {
            method: request.method,
            headers: request.headers,
            ...bodyOf(request),
            signal,
            redirect: 'error',
            cache: 'no-store',
          }),
        catch: (cause) =>
          new HttpClientError.HttpClientError({
            reason: new HttpClientError.TransportError({ request, cause }),
          }),
      }),
      (response) => HttpClientResponse.fromWeb(request, response),
    ),
  );
  return sent.pipe(
    HttpClient.mapRequest(
      HttpClientRequest.prependUrl('http://porcelain.invalid'),
    ),
    HttpClient.transformResponse(
      Effect.provideService(HttpClient.TracerPropagationEnabled, false),
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
  signal?: AbortSignal,
): Effect.Effect<A, E | ConnectionError | RequestError, R> {
  const checked = Effect.catch(
    request,
    (error): Effect.Effect<never, E | ConnectionError | RequestError> =>
      HttpClientError.isHttpClientError(error)
        ? Effect.flatMap(unansweredRequest(error), Effect.fail)
        : Effect.fail(error),
  );
  return signal ? withSignal(checked, signal) : checked;
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
