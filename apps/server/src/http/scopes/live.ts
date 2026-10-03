import type { Limits } from '../../config/limits.ts';
import type { FastifyInstance } from 'fastify';
import type { AuthenticateOptions } from '../hooks/authenticate.ts';
import {
  authenticateLiveViewer,
  type LiveTicketOptions,
} from '../hooks/live-ticket.ts';
import {
  checkRequestOrigin,
  type RequestOriginOptions,
} from '../hooks/request-origin.ts';
import {
  liveUpdates,
  type LiveUpdatesOptions,
} from '../protocol/live-updates.ts';

export type LiveUseCases = AuthenticateOptions &
  LiveUpdatesOptions & {
    access: RequestOriginOptions['access'] & LiveTicketOptions['access'];
  };

export async function liveScope(
  server: FastifyInstance,
  options: {
    limits: Limits;
    application: LiveUseCases;
    allowedHosts: readonly string[];
  },
) {
  const { application, allowedHosts } = options;
  server.addHook(
    'onRequest',
    checkRequestOrigin(
      { access: application.access, allowedHosts },
      { crossOrigin: 'ticket', requireSameOrigin: true },
    ),
  );
  server.addHook(
    'onRequest',
    authenticateLiveViewer(application, {
      cookieMaxAgeSeconds: options.limits.access.device.cookieMaxAgeSeconds,
    }),
  );
  server.register(liveUpdates, {
    deviceConnections: application.deviceConnections,
    tunnelConnections: application.tunnelConnections,
    liveUpdates: application.liveUpdates,
    worktreeWatches: application.worktreeWatches,
    logger: application.logger,
  });
}
