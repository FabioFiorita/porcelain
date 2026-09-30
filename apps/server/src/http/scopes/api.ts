import cors from '@fastify/cors';
import type { Limits } from '../../config/limits.ts';
import type { FastifyInstance } from 'fastify';
import type { AuthenticateOptions } from '../hooks/authenticate.ts';
import { crossOriginClients } from '../hooks/cross-origin-clients.ts';
import { preventCaching } from '../hooks/prevent-caching.ts';
import {
  checkRequestOrigin,
  type RequestOriginOptions,
} from '../hooks/request-origin.ts';
import { hostScope, type HostUseCases } from './host.ts';
import { liveScope, type LiveUseCases } from './live.ts';
import { pairedScope, type PairedUseCases } from './paired.ts';
import { publicScope, type PublicUseCases } from './public.ts';

export type ApiUseCases = LiveUseCases &
  PairedUseCases &
  AuthenticateOptions & {
    access: PublicUseCases['access'] &
      RequestOriginOptions['access'] &
      HostUseCases['access'];
  };

export async function apiScope(
  server: FastifyInstance,
  options: {
    application: ApiUseCases;
    allowedHosts: readonly string[];
    limits: Limits;
  },
) {
  const { application, allowedHosts, limits } = options;
  const origins = { access: application.access, allowedHosts };
  server.addHook('onRequest', preventCaching);
  server.register(cors, {
    delegator: crossOriginClients({
      maxAgeSeconds: limits.http.corsMaxAgeSeconds,
    }),
  });
  server.register(liveScope, { application, allowedHosts, limits });
  server.register(publicScope, { application, allowedHosts, limits });
  server.register(async (paired) => {
    paired.addHook(
      'onRequest',
      checkRequestOrigin(origins, { crossOrigin: 'bearer' }),
    );
    paired.register(pairedScope, { application, limits });
  });
  server.register(async (host) => {
    host.addHook(
      'onRequest',
      checkRequestOrigin(origins, { crossOrigin: 'refused' }),
    );
    host.register(hostScope, { application, limits });
  });
}
