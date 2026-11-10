import { Effect, Context, Layer } from 'effect';
import { PushRegistrationDeviceRequiredError } from '../errors/push-registration-device-required-error.ts';
import type {
  SetPushRegistrationInput,
  SetPushRegistrationResult,
} from '../models/push-notifications.ts';
import { DeviceStore } from '../ports/device-store.ts';
import { PushRegistrationStore } from '../ports/push-registration-store.ts';
import { deviceRevoked } from '../rules/device-activity.ts';

export class SetPushRegistrationService extends Context.Service<
  SetPushRegistrationService,
  {
    readonly execute: (
      input: SetPushRegistrationInput,
    ) => Effect.Effect<
      SetPushRegistrationResult,
      PushRegistrationDeviceRequiredError
    >;
  }
>()('@porcelain/access/SetPushRegistrationService') {
  static readonly layer = Layer.effect(
    SetPushRegistrationService,
    Effect.gen(function* () {
      const registrations = yield* PushRegistrationStore;
      const devices = yield* DeviceStore;

      return {
        execute: Effect.fn('SetPushRegistrationService.execute')(function* (
          input: SetPushRegistrationInput,
        ): Effect.fn.Return<
          SetPushRegistrationResult,
          PushRegistrationDeviceRequiredError
        > {
          const { viewer } = input;
          if (viewer.kind !== 'device')
            return yield* Effect.fail(
              new PushRegistrationDeviceRequiredError(),
            );
          const device = yield* devices.find({ deviceId: viewer.deviceId });
          if (device === undefined || deviceRevoked(device))
            return yield* Effect.fail(
              new PushRegistrationDeviceRequiredError(),
            );
          yield* registrations.remove({ deviceId: viewer.deviceId });
          return { kind: 'cleared' };
        }),
      };
    }),
  );
}
