import { Effect, Context, Layer } from 'effect';
import { DeviceNotFoundError } from '../errors/device-not-found-error.ts';
import type {
  SetManagementPermissionInput,
  SetManagementPermissionResult,
} from '../models/sharing-management.ts';
import { DeviceStore } from '../ports/device-store.ts';
import { deviceRevoked } from '../rules/device-activity.ts';

export class SetManagementPermissionService extends Context.Service<
  SetManagementPermissionService,
  {
    readonly execute: (
      input: SetManagementPermissionInput,
    ) => Effect.Effect<SetManagementPermissionResult, DeviceNotFoundError>;
  }
>()('@porcelain/access/SetManagementPermissionService') {
  static readonly layer = Layer.effect(
    SetManagementPermissionService,
    Effect.gen(function* () {
      const devices = yield* DeviceStore;

      return {
        execute: Effect.fn('SetManagementPermissionService.execute')(function* (
          input: SetManagementPermissionInput,
        ): Effect.fn.Return<
          SetManagementPermissionResult,
          DeviceNotFoundError
        > {
          const device = yield* devices.find({ deviceId: input.id });
          if (!device || deviceRevoked(device))
            return yield* Effect.fail(new DeviceNotFoundError());
          yield* devices.recordManagementPermission({
            device,
            allowed: input.allowed,
          });
          return { id: device.id, allowed: input.allowed };
        }),
      };
    }),
  );
}
