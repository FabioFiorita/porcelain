import type { Limits } from '../../config/limits.ts';
import type { FastifyInstance } from 'fastify';
import { mountEffectRoutes, type EffectRoutes } from '../effect-bridge.ts';
import {
  deliverBrowserCredential,
  clearBrowserCredential,
  requireBrowserRequest,
} from '../hooks/browser-credential.ts';
import {
  refundSucceededPairingAttempt,
  takePairingAttempt,
  type PairingAttemptOptions,
} from '../hooks/pairing-attempts.ts';
import {
  checkRequestOrigin,
  type RequestOriginOptions,
} from '../hooks/request-origin.ts';

export type PublicUseCases = {
  access: PairingAttemptOptions['access'] &
    RequestOriginOptions['access'] & {
      routes: {
        public: EffectRoutes;
        browser: EffectRoutes;
        pairing: EffectRoutes;
      };
    };
};

export async function publicScope(
  server: FastifyInstance,
  options: {
    application: PublicUseCases;
    allowedHosts: readonly string[];
    limits: Limits;
  },
) {
  const { application } = options;
  const origins = {
    access: application.access,
    allowedHosts: options.allowedHosts,
  };
  server.register(async (anyone) => {
    anyone.addHook(
      'onRequest',
      checkRequestOrigin(origins, { crossOrigin: 'refused' }),
    );
    anyone.register(mountEffectRoutes, {
      routes: application.access.routes.public,
    });
    anyone.register(async (session) => {
      session.addHook('preHandler', requireBrowserRequest);
      session.addHook('preHandler', clearBrowserCredential);
      session.register(mountEffectRoutes, {
        routes: application.access.routes.browser,
      });
    });
  });
  server.register(async (pairing) => {
    pairing.addHook(
      'onRequest',
      checkRequestOrigin(origins, { crossOrigin: 'anyone' }),
    );
    pairing.addHook('preHandler', takePairingAttempt(application));
    pairing.addHook('onResponse', refundSucceededPairingAttempt(application));
    pairing.addHook(
      'preSerialization',
      deliverBrowserCredential({
        cookieMaxAgeSeconds: options.limits.access.device.cookieMaxAgeSeconds,
      }),
    );
    pairing.register(mountEffectRoutes, {
      routes: application.access.routes.pairing,
    });
  });
}
