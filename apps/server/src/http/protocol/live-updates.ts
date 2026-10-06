import { handlerAudit } from '../diagnostics.ts';
import {
  Layer,
  Effect,
  Queue,
  Result,
  Schema,
  Semaphore,
  Stream,
  Inspectable,
} from 'effect';
import {
  HttpRouter,
  HttpServerRequest,
  HttpServerResponse,
  HttpIncomingMessage,
} from 'effect/http';
import { Socket } from 'effect/socket';
import { RpcSerialization, RpcServer } from 'effect/rpc';
import {
  liveUpdatesQuerySchema,
  LiveUpdatesApi,
  LiveUpdatesRpc,
  type LiveNotice,
} from '@porcelain/contracts/access';
import type { LiveConnector } from '../../ports/live-connector.ts';
import type { TunnelConnectionStore } from '../../ports/tunnel-connection-store.ts';
import type { WatchOpener } from '../../ports/watch-demand.ts';
import type { AuthenticateOptions } from '../hooks/authenticate.ts';
import { NodeLiveSockets } from '../node-live-socket.ts';
import { RequestContext } from '../request-context.ts';
import { RequestError } from '../../runtime/errors/request-error.ts';

export type LiveUpdatesOptions = {
  tunnelConnections: Pick<TunnelConnectionStore, 'insert'>;
  liveUpdates: LiveConnector;
  worktreeWatches: WatchOpener;
};
export function liveUpdates(
  options: Pick<AuthenticateOptions, 'deviceConnections'> &
    LiveUpdatesOptions & { eventBuffer: number },
) {
  return HttpRouter.add(
    LiveUpdatesApi.groups.live.endpoints.liveUpdates.method,
    LiveUpdatesApi.groups.live.endpoints.liveUpdates.path,
    Effect.gen(function* () {
      const context = yield* RequestContext;
      const query = Schema.decodeUnknownResult(liveUpdatesQuerySchema, {
        onExcessProperty: 'error',
      })(
        Object.fromEntries(
          new URL(context.request.originalUrl, 'http://porcelain.invalid')
            .searchParams,
        ),
      );
      if (Result.isFailure(query))
        return yield* Effect.die(
          new RequestError({ statusCode: 400, message: 'Invalid request' }),
        );
      if (context.request.headers.upgrade?.toLowerCase() !== 'websocket')
        return HttpServerResponse.empty({ status: 404 });
      const principal = context.principal;
      if (principal?.kind !== 'device')
        return yield* Effect.die(
          new RequestError({
            statusCode: 403,
            message: 'Viewer connection required',
          }),
        );
      const upgraded = yield* context.request.upgrade;
      const reader = yield* upgraded.reader;
      const writer = yield* upgraded.writer;
      const sockets = yield* NodeLiveSockets;
      const ws = sockets.get(context.incoming);
      if (ws === undefined)
        return yield* Effect.die(
          new Error('The live RPC connection was not acquired'),
        );
      const socket = Socket.make({
        reader: Effect.succeed(reader),
        writer: Effect.succeed(writer),
      });
      const watches = yield* options.worktreeWatches.open();
      if (watches.kind === 'at-capacity') {
        ws.close(1013, 'Live update capacity reached; try again later');
        return HttpServerResponse.empty();
      }
      const notices = yield* Effect.acquireRelease(
        Queue.bounded<LiveNotice>(options.eventBuffer),
        Queue.shutdown,
      );
      const connection = yield* options.liveUpdates.connect({
        send: (notice) => Queue.offer(notices, notice).pipe(Effect.asVoid),
        ping: () => Effect.sync(() => ws.ping()),
        terminate: () => Effect.sync(() => ws.terminate()),
      });
      const releaseDevice = options.deviceConnections.insert({
        deviceId: principal.deviceId,
        connection: {
          close: () => ws.close(4001, 'Device access revoked'),
        },
      });
      const releaseTunnel =
        context.client.tunnelHostname === undefined
          ? () => undefined
          : options.tunnelConnections.insert({
              hostname: context.client.tunnelHostname,
              connection: {
                close: () =>
                  ws.close(4003, 'This address no longer reaches Porcelain'),
              },
            });
      yield* Effect.addFinalizer(() =>
        Effect.sync(() => {
          releaseDevice();
          releaseTunnel();
        }),
      );
      const answered = () => Effect.runSync(connection.answered());
      yield* Effect.acquireRelease(
        Effect.sync(() => ws.on('pong', answered)),
        () => Effect.sync(() => ws.off('pong', answered)),
      );
      const readers = yield* Semaphore.make(1);
      const subscriptions = yield* Semaphore.make(1);
      const handlers = yield* LiveUpdatesRpc.toHandlers({
        notices: () =>
          Stream.unwrap(
            Effect.gen(function* () {
              yield* Effect.acquireRelease(readers.take(1), () =>
                readers.release(1),
              );
              return Stream.fromQueue(notices);
            }),
          ),
        follow: (request) =>
          subscriptions.withPermit(
            watches.demand
              .replace(request)
              .pipe(Effect.flatMap((targets) => connection.follow(targets))),
          ),
      });
      const serve = yield* RpcServer.toHttpEffectWebsocket(LiveUpdatesRpc, {
        disableTracing: true,
      }).pipe(
        Effect.provideContext(handlers),
        Effect.provideService(
          RpcSerialization.RpcSerialization,
          RpcSerialization.json,
        ),
      );
      return yield* serve.pipe(
        Effect.provideService(
          HttpServerRequest.HttpServerRequest,
          openedRequest(context.request, socket),
        ),
      );
    }).pipe(
      Effect.catchTag('SocketError', () =>
        Effect.succeed(HttpServerResponse.empty()),
      ),
    ),
  ).pipe(Layer.provide(handlerAudit.layer));
}

function openedRequest(
  request: HttpServerRequest.HttpServerRequest,
  socket: Socket.Socket,
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
    upgrade: Effect.succeed(socket),
    text: request.text,
    json: request.json,
    urlParamsBody: request.urlParamsBody,
    arrayBuffer: request.arrayBuffer,
    stream: request.stream,
    multipart: request.multipart,
    multipartStream: request.multipartStream,
    modify: (options) => openedRequest(request.modify(options), socket),
    toJSON: () => request.toJSON(),
    toString: () => request.toString(),
    [Inspectable.NodeInspectSymbol]: () => request.toJSON(),
  });
}
