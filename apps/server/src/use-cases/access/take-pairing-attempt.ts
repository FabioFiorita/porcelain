import { Context, Effect, Layer } from 'effect';
import { type TooManyPairingAttemptsError } from '@porcelain/access/errors';
import { type TakePairingAttemptInput } from '@porcelain/access/models';
import { TakePairingAttemptService } from '@porcelain/access/services';
import { LaneKeys } from '../../runtime/lane-keys.ts';
import { Lanes } from '../../runtime/lanes.ts';

export class TakePairingAttemptUseCase extends Context.Service<
  TakePairingAttemptUseCase,
  {
    readonly execute: (
      input: TakePairingAttemptInput,
    ) => Effect.Effect<void, TooManyPairingAttemptsError>;
  }
>()('@porcelain/server/TakePairingAttemptUseCase') {
  static readonly layer = Layer.effect(
    TakePairingAttemptUseCase,
    Effect.gen(function* () {
      const takePairingAttemptCapability = yield* TakePairingAttemptService;
      const lanesCapability = yield* Lanes;
      const laneKeysCapability = yield* LaneKeys;

      return {
        execute: Effect.fn('TakePairingAttemptUseCase.execute')(function* (
          input: TakePairingAttemptInput,
        ): Effect.fn.Return<void, TooManyPairingAttemptsError> {
          return yield* lanesCapability.run(
            laneKeysCapability.access(),
            'write',
            () =>
              Effect.gen(function* () {
                return yield* takePairingAttemptCapability.execute(input);
              }),
          );
        }),
      };
    }),
  );
}
