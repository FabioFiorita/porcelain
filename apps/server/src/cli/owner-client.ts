import { Effect, Schema } from 'effect';
import {
  HttpClient,
  HttpClientRequest,
  HttpClientResponse,
  HttpClientError,
} from 'effect/http';
import { HttpApiClient } from 'effect/http-api';
import { ownerStatusSchema } from '@porcelain/kernel/models';
import type { OwnerProbeResult } from '../ports/owner-probe.ts';
import { OwnerAccessApi, ReviewMcpApi } from '@porcelain/contracts/access';
import { NodeHttpClient } from '@effect/platform-node';
import { connect } from 'node:net';
import { ownerSocketPath } from '../config/owner-socket-settings.ts';
import { OwnerRequestError } from './errors/owner-request-error.ts';
import { OwnerSocketTimeoutError } from './errors/owner-socket-timeout-error.ts';

function socketAbsent(error: unknown): boolean {
  return (
    error instanceof Error &&
    'code' in error &&
    (error.code === 'ENOENT' || error.code === 'ECONNREFUSED')
  );
}

function reasonOf(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function socketHttpClient(
  socketPath: string,
  timeoutMs: number,
  timeoutMessage: string,
) {
  return HttpClient.mapRequest(
    HttpClient.make((request) =>
      Effect.scoped(
        Effect.gen(function* () {
          const agents = yield* NodeHttpClient.makeAgent({ keepAlive: false });
          agents.http.createConnection = () => connect({ path: socketPath });
          const client = yield* NodeHttpClient.makeNodeHttp.pipe(
            Effect.provideService(NodeHttpClient.HttpAgent, agents),
          );
          const response = yield* client.execute(request);
          const body = yield* response.text;
          return HttpClientResponse.fromWeb(
            request,
            new Response(response.status === 204 ? null : body, {
              status: response.status,
              headers: response.headers,
            }),
          );
        }),
      ).pipe(
        Effect.timeoutOrElse({
          duration: timeoutMs,
          orElse: () =>
            Effect.fail(
              new HttpClientError.HttpClientError({
                reason: new HttpClientError.TransportError({
                  request,
                  cause: new OwnerSocketTimeoutError({
                    message: timeoutMessage,
                  }),
                }),
              }),
            ),
        }),
      ),
    ),
    HttpClientRequest.prependUrl('http://porcelain-owner.invalid'),
  );
}

export function ownerHttpClient(dataDirectory: string, timeoutMs: number) {
  return socketHttpClient(
    ownerSocketPath(dataDirectory),
    timeoutMs,
    'The server did not answer in time.',
  ).pipe(
    HttpClient.transformResponse((response) =>
      response.pipe(
        Effect.mapError((error) =>
          error.reason._tag === 'TransportError' &&
          socketAbsent(error.reason.cause)
            ? new HttpClientError.HttpClientError({
                reason: new HttpClientError.TransportError({
                  request: error.request,
                  cause: new OwnerRequestError({
                    message: `Porcelain is not running for ${dataDirectory}.`,
                  }),
                }),
              })
            : error,
        ),
      ),
    ),
  );
}

export const ownerClient = Effect.fn('ownerClient')(function* (
  dataDirectory: string,
  timeoutMs: number,
) {
  return yield* HttpApiClient.makeWith(OwnerAccessApi, {
    httpClient: ownerHttpClient(dataDirectory, timeoutMs),
  });
});

const errorMessageSchema = Schema.Struct({ message: Schema.String });

export const ownerRequest = <A, E, R>(
  request: Effect.Effect<A, E, R>,
): Effect.Effect<A, OwnerRequestError, R> =>
  request.pipe(
    Effect.catch((error) =>
      Effect.gen(function* () {
        if (HttpClientError.isHttpClientError(error)) {
          if (error.reason._tag === 'TransportError')
            return yield* new OwnerRequestError({
              message: reasonOf(error.reason.cause),
            });
          if (error.response !== undefined) {
            const body = yield* HttpClientResponse.schemaBodyJson(
              errorMessageSchema,
            )(error.response).pipe(Effect.orElseSucceed(() => undefined));
            return yield* new OwnerRequestError({
              message:
                body?.message ??
                `The server answered ${error.response.status || 'nothing'}.`,
            });
          }
        }
        return yield* new OwnerRequestError({
          message: Schema.isSchemaError(error)
            ? 'The server answered unrecognizably.'
            : reasonOf(error),
        });
      }),
    ),
  );

export const relayToOwner = Effect.fn('relayToOwner')(function* (
  socketPath: string,
  message: unknown,
  cwd: string,
  timeoutMs: number,
  sessionHeaders: Record<string, string>,
) {
  const client = socketHttpClient(
    socketPath,
    timeoutMs,
    'The Porcelain server did not answer in time.',
  );
  const endpoint = ReviewMcpApi.groups.reviewMcp.endpoints.reviewMcp;
  const request = yield* HttpClientRequest.bodyJson(
    HttpClientRequest.make(endpoint.method)(endpoint.path).pipe(
      HttpClientRequest.setHeaders({
        ...sessionHeaders,
        accept: 'application/json, text/event-stream',
        'x-porcelain-cwd': cwd,
      }),
    ),
    message,
  );
  return yield* Effect.gen(function* () {
    const response = yield* client.execute(request);
    return {
      status: response.status,
      body: yield* response.text,
      headers: new Headers(response.headers),
    };
  }).pipe(
    Effect.mapError(
      (error) =>
        new OwnerRequestError({
          message:
            error.reason._tag === 'TransportError'
              ? socketAbsent(error.reason.cause)
                ? 'Porcelain is not running.'
                : reasonOf(error.reason.cause)
              : reasonOf(error),
        }),
    ),
  );
});

export const probeOwner = Effect.fn('probeOwner')(function* (input: {
  readonly socketPath: string;
  readonly timeoutMs: number;
}): Effect.fn.Return<OwnerProbeResult> {
  const client = socketHttpClient(
    input.socketPath,
    input.timeoutMs,
    'the owner socket did not answer in time',
  );
  return yield* Effect.gen(function* (): Effect.fn.Return<
    OwnerProbeResult,
    HttpClientError.HttpClientError
  > {
    const response = yield* client.get('/status');
    if (response.status !== 200)
      return {
        kind: 'unreadable',
        reason: `the owner socket answered ${response.status || 'nothing'}`,
      };
    return yield* HttpClientResponse.schemaBodyJson(ownerStatusSchema)(
      response,
    ).pipe(
      Effect.map((status): OwnerProbeResult => ({ kind: 'running', status })),
      Effect.orElseSucceed((): OwnerProbeResult => ({
        kind: 'unreadable',
        reason: 'the owner socket answered something unrecognizable',
      })),
    );
  }).pipe(
    Effect.catch((error) =>
      Effect.succeed<OwnerProbeResult>(
        error.reason._tag === 'TransportError' &&
          socketAbsent(error.reason.cause)
          ? { kind: 'absent' }
          : {
              kind: 'unreadable',
              reason:
                error.reason._tag === 'TransportError'
                  ? reasonOf(error.reason.cause)
                  : reasonOf(error),
            },
      ),
    ),
  );
});
