import { nativeOperation } from '@porcelain/effects';
import { Cause, Effect, Exit, Schema } from 'effect';
import {
  HttpClient,
  HttpClientRequest,
  HttpClientResponse,
  HttpClientError,
} from 'effect/http';
import { HttpApiClient } from 'effect/http-api';
import { OwnerAccessApi, ReviewMcpApi } from '@porcelain/contracts/access';
import type { HttpMethod } from 'effect/http';
import { request as httpRequest } from 'node:http';
import type { IncomingHttpHeaders } from 'node:http';
import { ownerSocketPath } from '../config/owner-socket-settings.ts';
import { OwnerRequestError } from './errors/owner-request-error.ts';
import { OwnerSocketTimeoutError } from './errors/owner-socket-timeout-error.ts';

type OwnerMethod = HttpMethod.HttpMethod;

type OwnerExchange = {
  method: OwnerMethod;
  path: string;
  body?: string | undefined;
  headers?: Record<string, string> | undefined;
  timeoutMs: number;
  timeoutMessage: string;
  signal?: AbortSignal;
};

type OwnerAnswer = { status: number; body: string; headers: Headers };

function exchange(
  socketPath: string,
  call: OwnerExchange,
): Promise<OwnerAnswer> {
  return new Promise((resolve, reject) => {
    const outgoing = httpRequest(
      {
        socketPath,
        path: call.path,
        method: call.method,
        timeout: call.timeoutMs,
        agent: false,
        ...(call.signal === undefined ? {} : { signal: call.signal }),
        headers:
          call.body === undefined
            ? (call.headers ?? {})
            : {
                ...call.headers,
                'content-type': 'application/json',
                'content-length': Buffer.byteLength(call.body),
              },
      },
      (response) => {
        const chunks: Buffer[] = [];
        response.on('data', (chunk: Buffer) => chunks.push(chunk));
        response.on('end', () =>
          resolve({
            status: response.statusCode ?? 0,
            headers: responseHeaders(response.headers),
            body: Buffer.concat(chunks).toString('utf8'),
          }),
        );
        response.on('error', reject);
      },
    );
    outgoing.on('timeout', () =>
      outgoing.destroy(new OwnerSocketTimeoutError(call.timeoutMessage)),
    );
    outgoing.on('error', reject);
    if (call.body !== undefined) outgoing.write(call.body);
    outgoing.end();
  });
}

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

function responseHeaders(headers: IncomingHttpHeaders): Headers {
  const result = new Headers();
  for (const [name, value] of Object.entries(headers))
    if (value !== undefined)
      result.set(name, Array.isArray(value) ? value.join(', ') : value);
  return result;
}

export function ownerHttpClient(dataDirectory: string, timeoutMs: number) {
  const socketPath = ownerSocketPath(dataDirectory);
  return HttpClient.mapRequest(
    HttpClient.make((request, url, signal) => {
      if (request.body._tag !== 'Empty' && request.body._tag !== 'Uint8Array')
        return Effect.fail(
          new HttpClientError.HttpClientError({
            reason: new HttpClientError.EncodeError({
              request,
              description: 'The owner socket accepts only JSON request bodies.',
            }),
          }),
        );
      return nativeOperation(() =>
        exchange(socketPath, {
          method: request.method,
          path: `${url.pathname}${url.search}`,
          headers: request.headers,
          ...(request.body._tag === 'Uint8Array'
            ? { body: new TextDecoder().decode(request.body.body) }
            : {}),
          timeoutMs,
          timeoutMessage: 'The server did not answer in time.',
          signal,
        }),
      ).pipe(
        Effect.map((answer) =>
          HttpClientResponse.fromWeb(
            request,
            new Response(answer.status === 204 ? null : answer.body, {
              status: answer.status,
              headers: answer.headers,
            }),
          ),
        ),
        Effect.catchDefect((cause) =>
          Effect.fail(
            new HttpClientError.HttpClientError({
              reason: new HttpClientError.TransportError({
                request,
                cause: new OwnerRequestError(
                  socketAbsent(cause)
                    ? `Porcelain is not running for ${dataDirectory}.`
                    : reasonOf(cause),
                ),
              }),
            }),
          ),
        ),
      );
    }),
    HttpClientRequest.prependUrl('http://porcelain-owner.invalid'),
  );
}

export function ownerClient(dataDirectory: string, timeoutMs: number) {
  return Effect.runSync(
    HttpApiClient.makeWith(OwnerAccessApi, {
      httpClient: ownerHttpClient(dataDirectory, timeoutMs),
    }),
  );
}

export async function runOwner<A, E>(request: Effect.Effect<A, E>): Promise<A> {
  const exit = await Effect.runPromiseExit(request);
  if (Exit.isSuccess(exit)) return exit.value;
  const error = Cause.squash(exit.cause);
  if (HttpClientError.isHttpClientError(error)) {
    if (error.reason._tag === 'TransportError')
      throw new OwnerRequestError(reasonOf(error.reason.cause));
    if (error.response !== undefined) {
      const body: unknown = await Effect.runPromise(
        Effect.orElseSucceed(error.response.json, () => undefined),
      );
      const message =
        body &&
        typeof body === 'object' &&
        'message' in body &&
        typeof body.message === 'string'
          ? body.message
          : `The server answered ${error.response.status || 'nothing'}.`;
      throw new OwnerRequestError(message);
    }
  }
  throw new OwnerRequestError(
    Schema.isSchemaError(error)
      ? 'The server answered unrecognizably.'
      : reasonOf(error),
  );
}

export async function relayToOwner(
  socketPath: string,
  message: unknown,
  cwd: string,
  timeoutMs: number,
  sessionHeaders: Record<string, string>,
): Promise<OwnerAnswer> {
  try {
    return await exchange(socketPath, {
      method: ReviewMcpApi.groups.reviewMcp.endpoints.reviewMcp.method,
      path: ReviewMcpApi.groups.reviewMcp.endpoints.reviewMcp.path,
      body: JSON.stringify(message),
      headers: {
        ...sessionHeaders,
        accept: 'application/json, text/event-stream',
        'x-porcelain-cwd': cwd,
      },
      timeoutMs,
      timeoutMessage: 'The Porcelain server did not answer in time.',
    });
  } catch (error) {
    throw socketAbsent(error)
      ? new OwnerRequestError('Porcelain is not running.')
      : error;
  }
}
