import { Effect } from 'effect';
import { withSignal } from '@porcelain/effects';
import type { FastifyReply, FastifyRequest } from 'fastify';
import type { RefundPairingAttemptUseCasePort } from '../../ports/refund-pairing-attempt-use-case-port.ts';
import type { TakePairingAttemptUseCasePort } from '../../ports/take-pairing-attempt-use-case-port.ts';

export type PairingAttemptOptions = {
  access: {
    takePairingAttempt: TakePairingAttemptUseCasePort;
    refundPairingAttempt: RefundPairingAttemptUseCasePort;
  };
};

export function takePairingAttempt(options: PairingAttemptOptions) {
  return async (request: FastifyRequest) => {
    await Effect.runPromise(
      withSignal(
        options.access.takePairingAttempt.execute({
          peer: request.client.address,
          crossOrigin: request.crossOrigin,
        }),
        request.disconnected,
      ),
    );
  };
}

export function refundSucceededPairingAttempt(options: PairingAttemptOptions) {
  return async (request: FastifyRequest, reply: FastifyReply) => {
    if (reply.statusCode === 200)
      await Effect.runPromise(
        withSignal(
          options.access.refundPairingAttempt.execute({
            peer: request.client.address,
            crossOrigin: request.crossOrigin,
          }),
          request.disconnected,
        ),
      );
  };
}
