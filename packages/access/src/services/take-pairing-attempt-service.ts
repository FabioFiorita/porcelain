import { TakePairingAttemptOptions } from '../ports/take-pairing-attempt-options.ts';
import { PairingAttemptBudgetStore } from '../ports/pairing-attempt-budget-store.ts';
import { Effect, Context, Layer, Clock, DateTime } from 'effect';
import { TooManyPairingAttemptsError } from '../errors/too-many-pairing-attempts-error.ts';

import type { TakePairingAttemptInput } from '../models/take-pairing-attempt.ts';
import { takePairingAttempt } from '../rules/pairing-attempts.ts';

export class TakePairingAttemptService extends Context.Service<
  TakePairingAttemptService,
  {
    readonly execute: (
      input: TakePairingAttemptInput,
    ) => Effect.Effect<void, TooManyPairingAttemptsError>;
  }
>()('@porcelain/access/TakePairingAttemptService') {
  static readonly layer = Layer.effect(
    TakePairingAttemptService,
    Effect.gen(function* () {
      const pairingAttempts = yield* PairingAttemptBudgetStore;
      const clock = yield* Clock.Clock;
      const options = yield* TakePairingAttemptOptions;

      return {
        execute: Effect.fn('TakePairingAttemptService.execute')(function* (
          input: TakePairingAttemptInput,
        ): Effect.fn.Return<void, TooManyPairingAttemptsError> {
          const budget = input.crossOrigin ? 'crossOrigin' : 'sameOrigin';
          const store = pairingAttempts[budget];
          const { attempts, taken } = takePairingAttempt(
            store.read(),
            input.peer,
            DateTime.formatIso(
              DateTime.makeUnsafe(yield* clock.currentTimeMillis),
            ),
            options[budget],
          );
          store.save(attempts);
          if (!taken)
            return yield* Effect.fail(new TooManyPairingAttemptsError());
        }),
      };
    }),
  );
}
