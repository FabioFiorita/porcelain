import type { Limits } from '../../config/limits.ts';
import type { FastifyInstance } from 'fastify';
import { mountEffectRoutes, type EffectRoutes } from '../effect-bridge.ts';
import {
  authenticate,
  type AuthenticateOptions,
} from '../hooks/authenticate.ts';
import {
  requireLocalDevice,
  type LocalDeviceOptions,
} from '../hooks/local-device.ts';

export type HostUseCases = {
  access: LocalDeviceOptions['access'] & { routes: { host: EffectRoutes } };
};

export async function hostScope(
  server: FastifyInstance,
  options: {
    application: HostUseCases & AuthenticateOptions;
    limits: Limits;
  },
) {
  const { application } = options;
  server.addHook(
    'onRequest',
    authenticate(application, {
      cookieMaxAgeSeconds: options.limits.access.device.cookieMaxAgeSeconds,
    }),
  );
  server.addHook('onRequest', requireLocalDevice(application));
  server.register(mountEffectRoutes, {
    routes: application.access.routes.host,
  });
}
