import {
  liveSubscriptionSchema,
  type LiveNotice,
  type LiveSubscription,
} from '@porcelain/contracts/access';
import type { FastifyInstance } from 'fastify';
import { WebSocket } from 'ws';
import type { AuthenticateOptions } from '../hooks/authenticate.ts';
import { callerOf } from '../principal.ts';

export type LiveUpdatesOptions = {
  liveUpdates: {
    connect(send: (notice: LiveNotice) => void): {
      subscribe(value: LiveSubscription): Promise<void>;
      close(): void;
    };
  };
};

export function liveUpdates(
  server: FastifyInstance,
  options: Pick<AuthenticateOptions, 'devices'> &
    LiveUpdatesOptions & { pingMs: number },
) {
  server.get('/live', { websocket: true }, (socket, request) => {
    const principal = callerOf(request);
    if (principal.kind !== 'viewer' || principal.deviceId === null) {
      socket.close(1008, 'Viewer connection required');
      return;
    }
    let alive = true;
    const connection = options.liveUpdates.connect((notice) => {
      if (socket.readyState === WebSocket.OPEN)
        socket.send(JSON.stringify(notice));
    });
    const releaseDevice = options.devices.hold(principal.deviceId, {
      close: () => socket.close(4001, 'Device access revoked'),
    });
    const heartbeat = setInterval(() => {
      if (!alive) return socket.terminate();
      alive = false;
      socket.ping();
    }, options.pingMs);
    heartbeat.unref();
    const close = () => {
      clearInterval(heartbeat);
      releaseDevice();
      connection.close();
    };
    socket.on('pong', () => {
      alive = true;
    });
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
      void connection.subscribe(parsed.data).catch(() => {
        socket.close(1008, 'Subscription refused');
      });
    });
    socket.once('close', close);
    socket.once('error', close);
  });
}
