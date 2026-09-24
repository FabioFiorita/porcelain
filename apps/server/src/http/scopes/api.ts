import type { Limits } from '../../config/limits.ts';
import type { FastifyInstance } from 'fastify';
import type { AuthenticateOptions } from '../hooks/authenticate.ts';
import { preventCaching } from '../hooks/prevent-caching.ts';
import {
  checkRequestOrigin,
  type RequestOriginOptions,
} from '../hooks/request-origin.ts';
import { liveScope, type LiveUseCases } from './live.ts';
import { pairedScope, type PairedUseCases } from './paired.ts';
import { publicScope, type PublicUseCases } from './public.ts';

export type ApiUseCases = LiveUseCases &
  PairedUseCases &
  AuthenticateOptions & {
    access: PublicUseCases['access'] & RequestOriginOptions['access'];
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
  server.addHook('onRequest', preventCaching);
  server.register(liveScope, { application, allowedHosts, limits });
  server.register(async (http) => {
    http.addHook(
      'onRequest',
      checkRequestOrigin({ access: application.access, allowedHosts }),
    );
    http.register(publicScope, { application, limits });
    http.register(pairedScope, { application, limits });
  });
}
