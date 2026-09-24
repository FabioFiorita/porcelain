import type { FastifyReply, FastifyRequest } from 'fastify';
import type { RefundPairingAttemptUseCase } from '../../use-cases/access/refund-pairing-attempt.ts';
import type { TakePairingAttemptUseCase } from '../../use-cases/access/take-pairing-attempt.ts';

export type PairingAttemptOptions = {
  access: {
    takePairingAttempt: Pick<TakePairingAttemptUseCase, 'execute'>;
    refundPairingAttempt: Pick<RefundPairingAttemptUseCase, 'execute'>;
  };
};

export function takePairingAttempt(options: PairingAttemptOptions) {
  return async (request: FastifyRequest) => {
    await options.access.takePairingAttempt.execute(
      { peer: request.ip },
      { signal: request.disconnected },
    );
  };
}

export function refundSucceededPairingAttempt(options: PairingAttemptOptions) {
  return async (request: FastifyRequest, reply: FastifyReply) => {
    if (reply.statusCode === 200)
      await options.access.refundPairingAttempt.execute(
        { peer: request.ip },
        { signal: request.disconnected },
      );
  };
}
