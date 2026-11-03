import { Context, Effect, Layer } from 'effect';
import { type PushRegistrationDeviceRequiredError } from '@porcelain/access/errors';
import { ClearPushRegistrationService } from '@porcelain/access/services';
import { type ClearPushRegistrationInput } from '@porcelain/contracts/access';
import { LaneKeys } from '../../runtime/lane-keys.ts';
import { Lanes } from '../../runtime/lanes.ts';

export class ClearPushRegistrationUseCase extends Context.Service<
  ClearPushRegistrationUseCase,
  {
    readonly execute: (
      input: ClearPushRegistrationInput,
    ) => Effect.Effect<undefined, PushRegistrationDeviceRequiredError>;
  }
>()('@porcelain/server/ClearPushRegistrationUseCase') {
  static readonly layer = Layer.effect(
    ClearPushRegistrationUseCase,
    Effect.gen(function* () {
      const clearPushRegistrationCapability =
        yield* ClearPushRegistrationService;
      const lanesCapability = yield* Lanes;
      const laneKeysCapability = yield* LaneKeys;

      return {
        execute: Effect.fn('ClearPushRegistrationUseCase.execute')(function* (
          input: ClearPushRegistrationInput,
        ): Effect.fn.Return<undefined, PushRegistrationDeviceRequiredError> {
          yield* lanesCapability.run(laneKeysCapability.access(), 'write', () =>
            clearPushRegistrationCapability.execute(input),
          );
          return undefined;
        }),
      };
    }),
  );
}
