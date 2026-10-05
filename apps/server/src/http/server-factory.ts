import type { TooManyPairingAttemptsError } from '@porcelain/access/errors';
import { createServer } from 'node:http';
import { HttpServer } from 'effect/http';
import { auditedRouter, httpEvent } from './diagnostics.ts';
import { NetAddress } from 'effect/net';
import { NodeLiveSockets, nodeLiveSockets } from './node-live-socket.ts';
import type { ListenOptions } from 'node:net';
import { NodeHttpServer, NodeHttpServerRequest } from '@effect/platform-node';
import type { Principal } from '@porcelain/contracts/access';
import { ByteSize, Effect, Exit, Layer, Scope } from 'effect';
import type { HttpServerError } from 'effect/http';
import {
  HttpIncomingMessage,
  HttpRouter,
  HttpServerRequest,
  HttpServerResponse,
} from 'effect/http';
import type { HttpApplication } from './application.ts';
import type { Logger } from '../ports/logger.ts';
import { RequestContext, requestServices } from './request-context.ts';
import { crossOriginHeaders } from './hooks/cross-origin-clients.ts';
import { errorResponse } from './error-handler.ts';

export function createHttpListener(options: {
  application: Layer.Layer<
    never,
    never,
    | Layer.Services<HttpApplication>
    | HttpRouter.Request.From<'Requires', NodeLiveSockets>
  >;
  principal: Principal | undefined;
  logger: Logger;
  websocketMaxBytes: number;
}) {
  const server = createServer();
  let scope: Scope.Closeable | undefined;
  const errors = HttpRouter.middleware<{
    handles: HttpServerError.HttpServerError;
  }>()(
    (app) =>
      Effect.flatMap(HttpServerRequest.HttpServerRequest, (request) =>
        app.pipe(
          Effect.catchTag('HttpServerError', (error) =>
            Effect.succeed(errorResponse(error, request, options.logger)),
          ),
          Effect.catchDefect((error) =>
            Effect.succeed(errorResponse(error, request, options.logger)),
          ),
        ),
      ),
    { global: true },
  );
  const application = Layer.mergeAll(options.application, errors).pipe(
    Layer.provideMerge(auditedRouter(options.principal?.kind === 'owner')),
    Layer.provide(requestServices),
  );
  return {
    server,
    async listen(listenOptions: ListenOptions): Promise<string> {
      if (scope !== undefined) throw new Error('HTTP listener is already open');
      const opened = await Effect.runPromise(Scope.make());
      scope = opened;
      try {
        await Effect.runPromise(
          Effect.gen(function* () {
            const live = yield* Effect.acquireRelease(
              Effect.sync(() => nodeLiveSockets(options.websocketMaxBytes)),
              (live) =>
                Effect.callback<void>((resume) =>
                  live.server.close(() => resume(Effect.void)),
                ),
            );
            yield* Effect.callback<void, Error>((resume) => {
              const failed = (error: Error) => resume(Effect.fail(error));
              server.once('error', failed);
              server.listen(listenOptions, () => {
                server.off('error', failed);
                resume(Effect.void);
              });
            });
            yield* Effect.addFinalizer(() =>
              Effect.callback<void>((resume) => {
                server.close(() => resume(Effect.void));
              }),
            );
            const address = server.address();
            if (address === null)
              return yield* Effect.die(
                new Error('HTTP listener has no address'),
              );
            const nativeAddress =
              typeof address === 'string'
                ? NetAddress.unixPathAddress(address)
                : yield* Effect.fromResult(
                    NetAddress.inetAddressFromIpString(
                      address.address,
                      address.port,
                    ),
                  );
            const nativeServer = HttpServer.make({
              address: nativeAddress,
              serve: <E>(
                app: Effect.Effect<
                  HttpServerResponse.HttpServerResponse,
                  E,
                  HttpServerRequest.HttpServerRequest | Scope.Scope
                >,
              ) =>
                Effect.gen(function* () {
                  const ownedScope = yield* Effect.scope;
                  const handler = yield* NodeHttpServer.makeHandler(
                    Effect.orDie(app),
                    { scope: ownedScope },
                  );
                  const upgrade = yield* NodeHttpServer.makeUpgradeHandler(
                    Effect.succeed(live.server),
                    Effect.orDie(app),
                    { scope: ownedScope },
                  );
                  server.on('request', handler);
                  server.on('upgrade', upgrade);
                  yield* Effect.addFinalizer(() =>
                    Effect.sync(() => {
                      server.off('request', handler);
                      server.off('upgrade', upgrade);
                    }),
                  );
                }),
            });
            yield* Layer.buildWithScope(
              HttpRouter.serve(application, {
                disableLogger: true,
                disableListenLog: true,
              }).pipe(
                Layer.provide(
                  Layer.mergeAll(
                    Layer.succeed(HttpServer.HttpServer, nativeServer),
                    Layer.succeed(NodeLiveSockets, live),
                    NodeHttpServer.layerHttpServices,
                  ),
                ),
              ),
              opened,
            );
          }).pipe(Scope.provide(opened)),
        );
        const address = server.address();
        if (address === null) throw new Error('HTTP listener has no address');
        return typeof address === 'string'
          ? address
          : `http://${address.family === 'IPv6' ? `[${address.address}]` : address.address}:${address.port}`;
      } catch (error) {
        await Effect.runPromise(Scope.close(opened, Exit.void));
        throw error;
      }
    },
    async close() {
      if (scope !== undefined) {
        const opened = scope;
        scope = undefined;
        await Effect.runPromise(Scope.close(opened, Exit.void));
      }
    },
  };
}

export function requestBoundary(options: {
  principal: Principal | undefined;
  logger: Logger;
  bodyBytes: number;
}) {
  return HttpRouter.middleware<{
    provides: RequestContext;
    handles: TooManyPairingAttemptsError | HttpServerError.HttpServerError;
  }>()((app) =>
    Effect.gen(function* () {
      const request = yield* HttpServerRequest.HttpServerRequest;
      const incoming = NodeHttpServerRequest.toIncomingMessage(request);
      const response = NodeHttpServerRequest.toServerResponse(request);
      const context = RequestContext.of({
        requestId: crypto.randomUUID(),
        request,
        incoming,
        response,
        client: {
          route: 'lan',
          address: incoming.socket.remoteAddress ?? '',
          secure: false,
        },
        principal: options.principal,
        crossOrigin: false,
        local: false,
      });
      const route = yield* HttpRouter.RouteContext;
      const owner = options.principal?.kind === 'owner';
      httpEvent({
        event: 'request',
        owner,
        id: context.requestId,
        method: request.method,
        route: route.route.path,
        path: request.originalUrl.split('?', 1)[0],
        kit: request.headers['x-porcelain-journey'] === 'kit',
      });
      const answer = yield* Effect.provideService(
        app,
        RequestContext,
        context,
      ).pipe(
        Effect.provideService(
          HttpIncomingMessage.MaxBodySize,
          ByteSize.fromInputUnsafe(options.bodyBytes),
        ),
        Effect.catchTags({
          TooManyPairingAttemptsError: (error) =>
            Effect.succeed(errorResponse(error, request, options.logger)),
          HttpServerError: (error) =>
            Effect.succeed(errorResponse(error, request, options.logger)),
        }),
        Effect.catchDefect((error) =>
          Effect.succeed(errorResponse(error, request, options.logger)),
        ),
      );
      httpEvent({
        event: 'response',
        owner,
        id: context.requestId,
        status: answer.status,
      });
      const headers = response.getHeaders();
      const withCookies =
        headers['set-cookie'] === undefined
          ? answer
          : HttpServerResponse.setHeader(
              answer,
              'Set-Cookie',
              String(headers['set-cookie']),
            );
      const withTransport = context.client.secure
        ? HttpServerResponse.setHeader(
            withCookies,
            'Strict-Transport-Security',
            String(headers['strict-transport-security'] ?? ''),
          )
        : withCookies;
      return yield* crossOriginHeaders(withTransport).pipe(
        Effect.provideService(RequestContext, context),
      );
    }),
  );
}

export type RequestBoundary = ReturnType<typeof requestBoundary>;
