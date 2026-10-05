import { NodeHttpServerRequest, NodeStream } from '@effect/platform-node';
import { ByteSize, Effect, Inspectable, Stream } from 'effect';
import {
  HttpMethod,
  HttpIncomingMessage,
  HttpRouter,
  HttpServerRequest,
} from 'effect/http';
import type { HttpApiEndpoint } from 'effect/http-api';
import { RequestError } from '../../runtime/errors/request-error.ts';

export function requestBodyLimit(
  endpoint: Pick<HttpApiEndpoint.Top, 'method' | 'path'>,
  maxBytes: number,
) {
  return HttpRouter.middleware((app) =>
    Effect.gen(function* () {
      const { route } = yield* HttpRouter.RouteContext;
      const request = yield* HttpServerRequest.HttpServerRequest;
      if (request.method !== endpoint.method || route.path !== endpoint.path)
        return yield* app;
      return yield* Effect.provideService(
        app,
        HttpIncomingMessage.MaxBodySize,
        ByteSize.fromInputUnsafe(maxBytes),
      );
    }),
  ).layer;
}

export const requestBody = HttpRouter.middleware((app) =>
  Effect.gen(function* () {
    const request = yield* HttpServerRequest.HttpServerRequest;
    if (!HttpMethod.hasBody(request.method)) return yield* app;
    const maxBytes = yield* HttpIncomingMessage.MaxBodySize;
    if (maxBytes === undefined)
      return yield* Effect.die(
        new Error('HTTP payloads require a configured byte limit'),
      );
    const incoming = NodeHttpServerRequest.toIncomingMessage(request);
    const response = NodeHttpServerRequest.toServerResponse(request);
    const oversized = () => {
      response.setHeader('Connection', 'close');
      response.once('finish', () => incoming.destroy());
      return new RequestError({
        statusCode: 413,
        message: 'Request body is too large',
      });
    };
    if (Number(request.headers['content-length']) > Number(maxBytes))
      return yield* Effect.die(oversized());
    const chunks: Uint8Array[] = [];
    const body = yield* NodeStream.fromReadable<Uint8Array, RequestError>({
      evaluate: () => incoming,
      closeOnDone: false,
      onError: () =>
        new RequestError({ statusCode: 400, message: 'Invalid request' }),
    }).pipe(
      Stream.runFoldEffect(
        () => ({ size: 0, chunks }),
        (acc, chunk) => {
          const size = acc.size + chunk.byteLength;
          if (size > Number(maxBytes)) return Effect.fail(oversized());
          acc.chunks.push(chunk);
          return Effect.succeed({ size, chunks: acc.chunks });
        },
      ),
      Effect.orDie,
    );
    const prepared = HttpServerRequest.fromWeb(
      new Request(new URL(request.originalUrl, 'http://porcelain.invalid'), {
        method: request.method,
        headers: request.headers,
        body: Uint8Array.from(Buffer.concat(body.chunks)),
      }),
    );
    return yield* Effect.provideService(
      app,
      HttpServerRequest.HttpServerRequest,
      bufferedRequest(request, prepared),
    );
  }),
);

function bufferedRequest(
  request: HttpServerRequest.HttpServerRequest,
  body: HttpServerRequest.HttpServerRequest,
): HttpServerRequest.HttpServerRequest {
  return HttpServerRequest.HttpServerRequest.of({
    [HttpServerRequest.TypeId]: HttpServerRequest.TypeId,
    [HttpIncomingMessage.TypeId]: HttpIncomingMessage.TypeId,
    source: request.source,
    url: request.url,
    originalUrl: request.originalUrl,
    method: request.method,
    headers: request.headers,
    cookies: request.cookies,
    remoteAddress: request.remoteAddress,
    upgrade: request.upgrade,
    text: body.text,
    json: body.json,
    urlParamsBody: body.urlParamsBody,
    arrayBuffer: body.arrayBuffer,
    stream: body.stream,
    multipart: body.multipart,
    multipartStream: body.multipartStream,
    modify: (options) => bufferedRequest(request.modify(options), body),
    toJSON: () => request.toJSON(),
    toString: () => request.toString(),
    [Inspectable.NodeInspectSymbol]: () => request.toJSON(),
  });
}
