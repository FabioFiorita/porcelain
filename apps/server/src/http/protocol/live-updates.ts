import { handlerAudit } from '../diagnostics.ts';
import { Layer, Effect, Result, Schema } from 'effect';
import { HttpRouter, HttpServerResponse } from 'effect/http';
import {
  liveSubscriptionSchema,
  liveUpdatesQuerySchema,
  LiveUpdatesApi,
} from '@porcelain/contracts/access';
import { WebSocket } from 'ws';
import type { LiveConnector } from '../../ports/live-connector.ts';
import type { Logger } from '../../ports/logger.ts';
import type { TunnelConnectionStore } from '../../ports/tunnel-connection-store.ts';
import type { WatchOpener } from '../../ports/watch-demand.ts';
import type { AuthenticateOptions } from '../hooks/authenticate.ts';
import { NodeLiveSockets } from '../node-live-socket.ts';
import { RequestContext } from '../request-context.ts';
import { RequestError } from '../../runtime/errors/request-error.ts';

export type LiveUpdatesOptions = {
  logger: Logger;
  tunnelConnections: Pick<TunnelConnectionStore, 'insert'>;
  liveUpdates: LiveConnector;
  worktreeWatches: WatchOpener;
};
export function liveUpdates(
  options: Pick<AuthenticateOptions, 'deviceConnections'> & LiveUpdatesOptions,
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
      const socket = yield* context.request.upgrade;
      const reader = yield* socket.reader;
      const sockets = yield* NodeLiveSockets;
      const ws = sockets.get(context.incoming);
      if (ws === undefined)
        return yield* Effect.die(
          new Error('The upgraded live connection was not acquired'),
        );
      const watches = options.worktreeWatches.open();
      if (watches.kind === 'at-capacity') {
        ws.close(1013, 'Live update capacity reached; try again later');
        return HttpServerResponse.empty();
      }
      const demand = watches.demand;
      const connection = options.liveUpdates.connect({
        send: (notice) => {
          if (ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify(notice));
        },
        ping: () => ws.ping(),
        terminate: () => ws.terminate(),
      });
      const releaseDevice = options.deviceConnections.insert({
        deviceId: principal.deviceId,
        connection: { close: () => ws.close(4001, 'Device access revoked') },
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
          demand.close();
          connection.close();
        }),
      );
      ws.on('pong', () => connection.answered());
      const receive = Effect.gen(function* () {
        const batch = yield* reader.pull;
        for (const bytes of batch) {
          if (typeof bytes !== 'string') {
            ws.close(1003, 'Text messages only');
            return;
          }
          let value: unknown;
          try {
            value = JSON.parse(bytes);
          } catch {
            ws.close(1007, 'Invalid JSON');
            return;
          }
          const parsed = Schema.decodeUnknownResult(liveSubscriptionSchema, {
            onExcessProperty: 'error',
          })(value);
          if (Result.isFailure(parsed)) {
            ws.close(1008, 'Invalid subscription');
            return;
          }
          yield* Effect.promise(() => demand.replace(parsed.success)).pipe(
            Effect.map((targets) => connection.follow(targets)),
            Effect.catchDefect((error) =>
              Effect.sync(() => {
                options.logger.failure({ kind: 'live-updates', error });
                ws.close(1011, 'Subscription could not be followed');
              }),
            ),
          );
        }
      });
      yield* Effect.forever(receive).pipe(
        Effect.catchTag('SocketError', () => Effect.void),
      );
      return HttpServerResponse.empty();
    }).pipe(
      Effect.catchTag('SocketError', () =>
        Effect.succeed(HttpServerResponse.empty()),
      ),
    ),
  ).pipe(Layer.provide(handlerAudit.layer));
}
