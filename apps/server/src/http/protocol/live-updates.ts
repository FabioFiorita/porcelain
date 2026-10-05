import { Result, Schema } from 'effect';
import { httpErrors } from '@fastify/sensible';
import {
  liveSubscriptionSchema,
  liveUpdatesQuerySchema,
  LiveUpdatesApi,
} from '@porcelain/contracts/access';
import type { FastifyInstance } from 'fastify';
import { WebSocket } from 'ws';
import type { LiveConnector } from '../../ports/live-connector.ts';
import type { Logger } from '../../ports/logger.ts';
import type { TunnelConnectionStore } from '../../ports/tunnel-connection-store.ts';
import type { WatchOpener } from '../../ports/watch-demand.ts';
import type { AuthenticateOptions } from '../hooks/authenticate.ts';

export type LiveUpdatesOptions = {
  logger: Logger;
  tunnelConnections: Pick<TunnelConnectionStore, 'insert'>;
  liveUpdates: LiveConnector;
  worktreeWatches: WatchOpener;
};

export function liveUpdates(
  server: FastifyInstance,
  options: Pick<AuthenticateOptions, 'deviceConnections'> & LiveUpdatesOptions,
) {
  server.route({
    method: LiveUpdatesApi.groups.live.endpoints.liveUpdates.method,
    url: LiveUpdatesApi.groups.live.endpoints.liveUpdates.path.replace(
      /^\/api/,
      '',
    ),
    preValidation: async (request) => {
      const query = Schema.decodeUnknownResult(liveUpdatesQuerySchema, {
        onExcessProperty: 'error',
      })(request.query);
      if (Result.isFailure(query))
        throw httpErrors.badRequest('Invalid request');
    },
    handler: (_request, reply) => reply.code(404).send(),
    wsHandler: (socket, request) => {
      const principal = request.caller;
      if (principal.kind !== 'device') {
        socket.close(1008, 'Viewer connection required');
        return;
      }
      const opened = options.worktreeWatches.open();
      if (opened.kind === 'at-capacity') {
        socket.close(1013, 'Live update capacity reached; try again later');
        return;
      }
      const watches = opened.demand;
      const connection = options.liveUpdates.connect({
        send: (notice) => {
          if (socket.readyState === WebSocket.OPEN)
            socket.send(JSON.stringify(notice));
        },
        ping: () => socket.ping(),
        terminate: () => socket.terminate(),
      });
      const releaseDevice = options.deviceConnections.insert({
        deviceId: principal.deviceId,
        connection: {
          close: () => socket.close(4001, 'Device access revoked'),
        },
      });
      const { tunnelHostname } = request.client;
      const releaseTunnel =
        tunnelHostname === undefined
          ? () => undefined
          : options.tunnelConnections.insert({
              hostname: tunnelHostname,
              connection: {
                close: () =>
                  socket.close(
                    4003,
                    'This address no longer reaches Porcelain',
                  ),
              },
            });
      const close = () => {
        releaseDevice();
        releaseTunnel();
        watches.close();
        connection.close();
      };
      socket.on('pong', () => connection.answered());
      socket.on('message', (bytes, binary) => {
        if (binary) return socket.close(1003, 'Text messages only');
        let value: unknown;
        try {
          const body = Buffer.isBuffer(bytes)
            ? bytes
            : Array.isArray(bytes)
              ? Buffer.concat(bytes)
              : Buffer.from(bytes);
          value = JSON.parse(body.toString('utf8'));
        } catch {
          return socket.close(1007, 'Invalid JSON');
        }
        const parsed = Schema.decodeUnknownResult(liveSubscriptionSchema, {
          onExcessProperty: 'error',
        })(value);
        if (Result.isFailure(parsed))
          return socket.close(1008, 'Invalid subscription');
        watches.replace(parsed.success).then(
          (targets) => connection.follow(targets),
          (error: unknown) => {
            options.logger.failure({ kind: 'live-updates', error });
            socket.close(1011, 'Subscription could not be followed');
          },
        );
      });
      socket.once('close', close);
      socket.once('error', close);
    },
  });
}
