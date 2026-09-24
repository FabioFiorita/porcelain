import {
  liveSubscriptionSchema,
  type LiveNotice,
} from '@porcelain/contracts/access';
import type { FastifyInstance } from 'fastify';
import { WebSocket } from 'ws';
import type {
  FollowedTargets,
  WatchRequest,
} from '../../ports/followed-targets.ts';
import type { Logger } from '../../ports/logger.ts';
import type { AuthenticateOptions } from '../hooks/authenticate.ts';
import { callerOf } from '../principal.ts';

export type LiveUpdatesOptions = {
  logger: Logger;
  liveUpdates: {
    connect(channel: {
      send(notice: LiveNotice): void;
      ping(): void;
      terminate(): void;
    }): {
      follow(targets: FollowedTargets): void;
      answered(): void;
      close(): void;
    };
  };
  worktreeWatches: {
    open():
      | {
          kind: 'opened';
          demand: {
            replace(request: WatchRequest): Promise<FollowedTargets>;
            close(): void;
          };
        }
      | { kind: 'at-capacity' };
  };
};

export function liveUpdates(
  server: FastifyInstance,
  options: Pick<AuthenticateOptions, 'deviceConnections'> & LiveUpdatesOptions,
) {
  server.get('/live', { websocket: true }, (socket, request) => {
    const principal = callerOf(request);
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
    const releaseDevice = options.deviceConnections.hold({
      deviceId: principal.deviceId,
      connection: { close: () => socket.close(4001, 'Device access revoked') },
    });
    const close = () => {
      releaseDevice();
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
      const parsed = liveSubscriptionSchema.safeParse(value);
      if (!parsed.success) return socket.close(1008, 'Invalid subscription');
      watches.replace(parsed.data).then(
        (targets) => connection.follow(targets),
        (error: unknown) => {
          options.logger.failure({ kind: 'live-updates', error });
          socket.close(1011, 'Subscription could not be followed');
        },
      );
    });
    socket.once('close', close);
    socket.once('error', close);
  });
}
