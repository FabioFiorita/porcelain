import { Effect, Context, Layer } from 'effect';
import { DeviceNotFoundError } from '../errors/device-not-found-error.ts';
import type {
  SetWaysInPermissionInput,
  SetWaysInPermissionResult,
} from '../models/ways-in.ts';
import { DeviceStore } from '../ports/device-store.ts';
import { deviceRevoked } from '../rules/device-activity.ts';

export class SetWaysInPermissionService extends Context.Service<
  SetWaysInPermissionService,
  {
    readonly execute: (
      input: SetWaysInPermissionInput,
    ) => Effect.Effect<SetWaysInPermissionResult, DeviceNotFoundError>;
  }
>()('@porcelain/access/SetWaysInPermissionService') {
  static readonly layer = Layer.effect(
    SetWaysInPermissionService,
    Effect.gen(function* () {
      const devices = yield* DeviceStore;

      return {
        execute: Effect.fn('SetWaysInPermissionService.execute')(function* (
          input: SetWaysInPermissionInput,
        ): Effect.fn.Return<SetWaysInPermissionResult, DeviceNotFoundError> {
          const device = yield* devices.find({ deviceId: input.id });
          if (!device || deviceRevoked(device))
            return yield* Effect.fail(new DeviceNotFoundError());
          yield* devices.recordWaysInPermission({
            device,
            allowed: input.allowed,
          });
          return { id: device.id, allowed: input.allowed };
        }),
      };
    }),
  );
}
