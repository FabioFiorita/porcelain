import { Effect, Context, Layer } from 'effect';
import { DeviceNotFoundError } from '../errors/device-not-found-error.ts';
import type {
  SetDeviceTrustInput,
  SetDeviceTrustResult,
} from '../models/set-device-trust.ts';
import { DeviceStore } from '../ports/device-store.ts';
import { deviceRevoked } from '../rules/device-activity.ts';

export class SetDeviceTrustService extends Context.Service<
  SetDeviceTrustService,
  {
    readonly execute: (
      input: SetDeviceTrustInput,
    ) => Effect.Effect<SetDeviceTrustResult, DeviceNotFoundError>;
  }
>()('@porcelain/access/SetDeviceTrustService') {
  static readonly layer = Layer.effect(
    SetDeviceTrustService,
    Effect.gen(function* () {
      const devices = yield* DeviceStore;

      return {
        execute: Effect.fn('SetDeviceTrustService.execute')(function* (
          input: SetDeviceTrustInput,
        ): Effect.fn.Return<SetDeviceTrustResult, DeviceNotFoundError> {
          const device = yield* devices.find({ deviceId: input.id });
          if (!device || deviceRevoked(device))
            return yield* Effect.fail(new DeviceNotFoundError());
          yield* devices.recordTrust({ device, trusted: input.trusted });
          return { id: device.id, trusted: input.trusted };
        }),
      };
    }),
  );
}
