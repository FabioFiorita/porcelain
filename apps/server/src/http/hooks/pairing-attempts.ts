import type { HttpServerResponse } from 'effect/http';
import { deliverBrowserCredential } from './browser-credential.ts';
import { Effect } from 'effect';
import { RequestContext } from '../request-context.ts';
import type { RefundPairingAttemptUseCasePort } from '../../ports/refund-pairing-attempt-use-case-port.ts';
import type { TakePairingAttemptUseCasePort } from '../../ports/take-pairing-attempt-use-case-port.ts';

export type PairingAttemptOptions = {
  access: {
    takePairingAttempt: TakePairingAttemptUseCasePort;
    refundPairingAttempt: RefundPairingAttemptUseCasePort;
  };
};

export function takePairingAttempt(options: PairingAttemptOptions) {
  return Effect.gen(function* () {
    const context = yield* RequestContext;
    yield* options.access.takePairingAttempt.execute({
      peer: context.client.address,
      crossOrigin: context.crossOrigin,
    });
  });
}

function refundSucceededPairingAttempt(options: PairingAttemptOptions) {
  return Effect.gen(function* () {
    const context = yield* RequestContext;
    yield* options.access.refundPairingAttempt.execute({
      peer: context.client.address,
      crossOrigin: context.crossOrigin,
    });
  });
}

export function pairingResponse(
  options: PairingAttemptOptions,
  cookie: { cookieMaxAgeSeconds: number },
) {
  return (response: HttpServerResponse.HttpServerResponse) =>
    Effect.gen(function* () {
      if (response.status === 200)
        yield* refundSucceededPairingAttempt(options);
      return yield* deliverBrowserCredential(cookie, response);
    });
}
