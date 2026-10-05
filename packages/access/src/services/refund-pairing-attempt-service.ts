import { RefundPairingAttemptOptions } from '../ports/refund-pairing-attempt-options.ts';
import { PairingAttemptBudgetStore } from '../ports/pairing-attempt-budget-store.ts';
import { Effect, Context, Layer } from 'effect';
import { Clock } from '@porcelain/kernel/ports';

import type { RefundPairingAttemptInput } from '../models/refund-pairing-attempt.ts';
import { refundPairingAttempt } from '../rules/pairing-attempts.ts';

export class RefundPairingAttemptService extends Context.Service<
  RefundPairingAttemptService,
  {
    readonly execute: (
      input: RefundPairingAttemptInput,
    ) => Effect.Effect<void, never>;
  }
>()('@porcelain/access/RefundPairingAttemptService') {
  static readonly layer = Layer.effect(
    RefundPairingAttemptService,
    Effect.gen(function* () {
      const pairingAttempts = yield* PairingAttemptBudgetStore;
      const clock = yield* Clock;
      const options = yield* RefundPairingAttemptOptions;

      return {
        execute: Effect.fn('RefundPairingAttemptService.execute')(function* (
          input: RefundPairingAttemptInput,
        ): Effect.fn.Return<void, never> {
          return yield* Effect.sync<void>(() => {
            const budget = input.crossOrigin ? 'crossOrigin' : 'sameOrigin';
            const store = pairingAttempts[budget];
            store.save(
              refundPairingAttempt(
                store.read(),
                input.peer,
                clock.now(),
                options[budget],
              ),
            );
          });
        }),
      };
    }),
  );
}
