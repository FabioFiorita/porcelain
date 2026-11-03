import { Context, Effect, Layer } from 'effect';
import { type PushRegistrationDeviceRequiredError } from '@porcelain/access/errors';
import { SetPushRegistrationService } from '@porcelain/access/services';
import {
  type SetPushRegistrationInput,
  type SetPushRegistrationResponse,
} from '@porcelain/contracts/access';
import { LaneKeys } from '../../runtime/lane-keys.ts';
import { Lanes } from '../../runtime/lanes.ts';

export class SetPushRegistrationUseCase extends Context.Service<
  SetPushRegistrationUseCase,
  {
    readonly execute: (
      input: SetPushRegistrationInput,
    ) => Effect.Effect<
      SetPushRegistrationResponse,
      PushRegistrationDeviceRequiredError
    >;
  }
>()('@porcelain/server/SetPushRegistrationUseCase') {
  static readonly layer = Layer.effect(
    SetPushRegistrationUseCase,
    Effect.gen(function* () {
      const setPushRegistrationCapability = yield* SetPushRegistrationService;
      const lanesCapability = yield* Lanes;
      const laneKeysCapability = yield* LaneKeys;

      return {
        execute: Effect.fn('SetPushRegistrationUseCase.execute')(function* (
          input: SetPushRegistrationInput,
        ): Effect.fn.Return<
          SetPushRegistrationResponse,
          PushRegistrationDeviceRequiredError
        > {
          const result = yield* lanesCapability.run(
            laneKeysCapability.access(),
            'write',
            () => setPushRegistrationCapability.execute(input),
          );
          return {
            kinds:
              result.kind === 'registered' ? result.registration.kinds : [],
          };
        }),
      };
    }),
  );
}
