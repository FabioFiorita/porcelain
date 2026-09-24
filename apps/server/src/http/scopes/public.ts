import type { FastifyInstance } from 'fastify';
import type { ClearBrowserSessionUseCase } from '../../use-cases/access/clear-browser-session.ts';
import type { ReadHealthUseCase } from '../../use-cases/access/read-health.ts';
import type { RedeemPairingUseCase } from '../../use-cases/access/redeem-pairing.ts';
import {
  refundSucceededAttempt,
  takeAttempt,
  type AttemptLimit,
} from '../hooks/attempt-limit.ts';
import {
  deliverBrowserCredential,
  endBrowserSession,
  requireBrowserRequest,
} from '../hooks/browser-credential.ts';
import { clearBrowserSession } from '../routes/access/clear-browser-session.ts';
import { readHealth } from '../routes/access/read-health.ts';
import { redeemPairing } from '../routes/access/redeem-pairing.ts';

export type PublicUseCases = {
  access: {
    clearBrowserSession: Pick<ClearBrowserSessionUseCase, 'execute'>;
    readHealth: Pick<ReadHealthUseCase, 'execute'>;
    redeemPairing: Pick<RedeemPairingUseCase, 'execute'>;
  };
};

export async function publicScope(
  server: FastifyInstance,
  options: { application: PublicUseCases; attemptLimit: AttemptLimit },
) {
  const { application, attemptLimit } = options;
  server.register(readHealth, {
    useCase: application.access.readHealth,
  });
  server.register(async (session) => {
    session.addHook('preHandler', requireBrowserRequest);
    session.addHook('preHandler', endBrowserSession);
    session.register(clearBrowserSession, {
      useCase: application.access.clearBrowserSession,
    });
  });
  server.register(async (pairing) => {
    pairing.addHook('preHandler', takeAttempt(attemptLimit));
    pairing.addHook('onResponse', refundSucceededAttempt(attemptLimit));
    pairing.addHook('preSerialization', deliverBrowserCredential);
    pairing.register(redeemPairing, {
      useCase: application.access.redeemPairing,
    });
  });
}
