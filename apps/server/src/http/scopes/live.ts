import type { FastifyInstance } from 'fastify';
import {
  authenticate,
  type AuthenticateOptions,
} from '../hooks/authenticate.ts';
import {
  checkRequestOrigin,
  type RequestOriginOptions,
} from '../hooks/request-origin.ts';
import {
  liveUpdates,
  type LiveUpdatesOptions,
} from '../protocol/live-updates.ts';

export type LiveUseCases = AuthenticateOptions &
  Pick<RequestOriginOptions, 'access'> &
  LiveUpdatesOptions;

export async function liveScope(
  server: FastifyInstance,
  options: {
    application: LiveUseCases;
    allowedHosts: readonly string[];
    pingMs: number;
  },
) {
  const { application, allowedHosts } = options;
  server.addHook(
    'onRequest',
    checkRequestOrigin({ access: application.access, allowedHosts }, true),
  );
  server.addHook('onRequest', authenticate(application));
  server.register(liveUpdates, {
    deviceConnections: application.deviceConnections,
    liveUpdates: application.liveUpdates,
    worktreeWatches: application.worktreeWatches,
    pingMs: options.pingMs,
  });
}
