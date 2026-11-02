import { Context, Effect, Layer } from 'effect';
import type { WaysInCaller } from '../models/ways-in.ts';
import { DeviceStore } from '../ports/device-store.ts';
import { SharingManagementRequiredError } from '../errors/sharing-management-required-error.ts';
import { deviceRevoked } from '../rules/device-activity.ts';

export class AuthorizeSharingService extends Context.Service<
  AuthorizeSharingService,
  {
    readonly execute: (
      input: WaysInCaller,
    ) => Effect.Effect<void, SharingManagementRequiredError>;
  }
>()('@porcelain/access/AuthorizeSharingService') {
  static readonly layer = Layer.effect(
    AuthorizeSharingService,
    Effect.gen(function* () {
      const devices = yield* DeviceStore;
      return {
        execute: Effect.fn('AuthorizeSharingService.execute')(function* (
          input: WaysInCaller,
        ): Effect.fn.Return<void, SharingManagementRequiredError> {
          if (input.viewer.kind === 'owner') return;
          const device = yield* devices.find({
            deviceId: input.viewer.deviceId,
          });
          if (device && deviceRevoked(device))
            return yield* Effect.fail(new SharingManagementRequiredError());
          if (input.local) return;
          if (input.route === 'loopback' || device?.canManageSharing !== true)
            return yield* Effect.fail(new SharingManagementRequiredError());
        }),
      };
    }),
  );
}
