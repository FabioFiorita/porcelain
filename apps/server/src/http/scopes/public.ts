import type { Limits } from '../../config/limits.ts';
import type { FastifyInstance } from 'fastify';
import type { ClearBrowserSessionUseCase } from '../../use-cases/access/clear-browser-session.ts';
import type { ReadEnvironmentUseCase } from '../../use-cases/access/read-environment.ts';
import type { ReadHealthUseCase } from '../../use-cases/access/read-health.ts';
import type { RedeemPairingUseCase } from '../../use-cases/access/redeem-pairing.ts';
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
import { clearBrowserSession } from '../routes/access/clear-browser-session.ts';
import { readEnvironment } from '../routes/access/read-environment.ts';
import { readHealth } from '../routes/access/read-health.ts';
import { redeemPairing } from '../routes/access/redeem-pairing.ts';

export type PublicUseCases = {
  access: PairingAttemptOptions['access'] &
    RequestOriginOptions['access'] & {
      clearBrowserSession: Pick<ClearBrowserSessionUseCase, 'execute'>;
      readEnvironment: Pick<ReadEnvironmentUseCase, 'execute'>;
      readHealth: Pick<ReadHealthUseCase, 'execute'>;
      redeemPairing: Pick<RedeemPairingUseCase, 'execute'>;
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
    anyone.register(readHealth, {
      useCase: application.access.readHealth,
    });
    anyone.register(readEnvironment, {
      useCase: application.access.readEnvironment,
    });
    anyone.register(async (session) => {
      session.addHook('preHandler', requireBrowserRequest);
      session.addHook('preHandler', clearBrowserCredential);
      session.register(clearBrowserSession, {
        useCase: application.access.clearBrowserSession,
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
    pairing.register(redeemPairing, {
      useCase: application.access.redeemPairing,
    });
  });
}
