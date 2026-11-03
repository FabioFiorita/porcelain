import { Effect, Context, Layer } from 'effect';
import { PushRegistrationDeviceRequiredError } from '../errors/push-registration-device-required-error.ts';
import type { ClearPushRegistrationInput } from '../models/push-notifications.ts';
import { PushRegistrationStore } from '../ports/push-registration-store.ts';

export class ClearPushRegistrationService extends Context.Service<
  ClearPushRegistrationService,
  {
    readonly execute: (
      input: ClearPushRegistrationInput,
    ) => Effect.Effect<void, PushRegistrationDeviceRequiredError>;
  }
>()('@porcelain/access/ClearPushRegistrationService') {
  static readonly layer = Layer.effect(
    ClearPushRegistrationService,
    Effect.gen(function* () {
      const registrations = yield* PushRegistrationStore;

      return {
        execute: Effect.fn('ClearPushRegistrationService.execute')(function* (
          input: ClearPushRegistrationInput,
        ): Effect.fn.Return<void, PushRegistrationDeviceRequiredError> {
          const { viewer } = input;
          if (viewer.kind !== 'device')
            return yield* Effect.fail(
              new PushRegistrationDeviceRequiredError(),
            );
          yield* registrations.remove({ deviceId: viewer.deviceId });
        }),
      };
    }),
  );
}
