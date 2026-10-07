import type { TooManyPairingAttemptsError } from '@porcelain/access/errors';
import { createServer } from 'node:http';
import { HttpServer } from 'effect/http';
import { NetAddress } from 'effect/net';
import { auditedRouter, httpEvent } from './diagnostics.ts';
import { NodeLiveSockets, nodeLiveSockets } from './node-live-socket.ts';
import type { ListenOptions } from 'node:net';
import { NodeHttpServer, NodeHttpServerRequest } from '@effect/platform-node';
import type { Principal } from '@porcelain/contracts/access';
import {
  ByteSize,
  Effect,
  Exit,
  Fiber,
  Layer,
  Scope,
  Context,
  type Duration,
} from 'effect';
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
import type { Observability } from '../runtime/observability.ts';

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
  closeGrace: Duration.Duration;
}) {
  const server = createServer();
  let active = false;
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
    start: Effect.fn('HttpListener.start')(function* (
      listenOptions: ListenOptions,
    ) {
      const scope = yield* Scope.make();
      const bindingScope = yield* Scope.fork(scope, 'sequential');
      let live: ReturnType<typeof nodeLiveSockets> | undefined;
      const close = yield* Effect.cached(
        Effect.gen(function* () {
          const deadline = yield* Effect.forkChild(
            Effect.sleep(options.closeGrace).pipe(
              Effect.andThen(
                Effect.sync(() => {
                  server.closeAllConnections();
                  live?.terminate();
                }),
              ),
            ),
          );
          const draining = yield* Effect.forkChild(
            Effect.all(
              [
                Scope.close(bindingScope, Exit.void),
                live?.close ?? Effect.void,
              ],
              { concurrency: 'unbounded', discard: true },
            ),
          );
          yield* Fiber.await(draining).pipe(
            Effect.timeoutOrElse({
              duration: options.closeGrace,
              orElse: () => Effect.succeed(Exit.void),
            }),
          );
          yield* Scope.close(scope, Exit.void).pipe(
            Effect.ensuring(Fiber.join(draining)),
            Effect.ensuring(Fiber.interrupt(deadline)),
          );
        }).pipe(Effect.uninterruptible),
      );
      yield* Effect.addFinalizer(() => close);
      return yield* Effect.gen(function* () {
        yield* Effect.acquireRelease(
          Effect.sync(() => {
            if (active) throw new Error('HTTP listener is already open');
            active = true;
          }),
          () =>
            Effect.sync(() => {
              active = false;
            }),
        );
        const sockets = yield* Effect.acquireRelease(
          Effect.sync(() => {
            live = nodeLiveSockets(options.websocketMaxBytes);
            return live;
          }),
          (live) => live.close,
        );
        const platform = yield* Layer.buildWithScope(
          NodeHttpServer.layerServer(() => server, listenOptions),
          bindingScope,
        );
        const nativeServer = Context.get(platform, HttpServer.HttpServer);
        const serving = HttpServer.make({
          address: nativeServer.address,
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
                Effect.succeed(sockets.server),
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
                Layer.succeed(HttpServer.HttpServer, serving),
                Layer.succeed(NodeLiveSockets, sockets),
                NodeHttpServer.layerHttpServices,
              ),
            ),
          ),
          scope,
        );
        const address = nativeServer.address;
        return {
          address:
            address._tag === 'UnixPathAddress'
              ? address.path
              : `http://${NetAddress.formatInet(address)}`,
          close: () => close,
        };
      }).pipe(
        Scope.provide(scope),
        Effect.onExit((exit) => (Exit.isFailure(exit) ? close : Effect.void)),
        Effect.orDie,
      );
    }),
  };
}

export function requestBoundary(options: {
  principal: Principal | undefined;
  logger: Logger;
  observability: Context.Service.Shape<typeof Observability>;
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
      const answer = yield* options.observability.measure(
        { kind: 'request', name: route.route.path, method: request.method },
        Effect.provideService(app, RequestContext, context).pipe(
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
          Effect.tap((answer) =>
            Effect.annotateCurrentSpan(
              'http.response.status_code',
              answer.status,
            ),
          ),
        ),
        (answer) => (answer.status >= 500 ? 'failure' : 'success'),
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
