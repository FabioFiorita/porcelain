import type { Limits } from '../../config/limits.ts';
import type { FastifyInstance } from 'fastify';
import {
  authenticate,
  type AuthenticateOptions,
} from '../hooks/authenticate.ts';
import {
  recognizeLocalRequest,
  type LocalDeviceOptions,
} from '../hooks/local-device.ts';
import { mountEffectRoutes, type EffectRoutes } from '../effect-bridge.ts';

export type PairedUseCases = {
  access: LocalDeviceOptions['access'] & {
    routes: { session: EffectRoutes; updates: EffectRoutes };
  };
  projects: EffectRoutes;
  files: EffectRoutes;
  changes: EffectRoutes;
  reviews: EffectRoutes;
  gitActions: EffectRoutes;
};

export async function pairedScope(
  server: FastifyInstance,
  options: {
    application: PairedUseCases & AuthenticateOptions;
    limits: Limits;
  },
) {
  server.addHook(
    'onRequest',
    authenticate(options.application, {
      cookieMaxAgeSeconds: options.limits.access.device.cookieMaxAgeSeconds,
    }),
  );
  server.register(async (updates) => {
    updates.addHook('onRequest', recognizeLocalRequest(options.application));
    updates.register(mountEffectRoutes, {
      routes: options.application.access.routes.updates,
    });
  });
  server.register(mountEffectRoutes, {
    routes: options.application.access.routes.session,
  });
  server.register(mountEffectRoutes, {
    routes: options.application.gitActions,
  });

  server.register(mountEffectRoutes, { routes: options.application.reviews });
  server.register(mountEffectRoutes, { routes: options.application.files });
  server.register(mountEffectRoutes, { routes: options.application.changes });
  server.register(mountEffectRoutes, { routes: options.application.projects });
}
