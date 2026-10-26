import { Effect, Context, Layer } from 'effect';
import { WaysInPermissionRequiredError } from '../errors/ways-in-permission-required-error.ts';
import type { WaysInCaller } from '../models/ways-in.ts';
import { DeviceStore } from '../ports/device-store.ts';
import { deviceRevoked } from '../rules/device-activity.ts';

export class AuthorizeWaysInService extends Context.Service<
  AuthorizeWaysInService,
  {
    readonly execute: (
      input: WaysInCaller,
    ) => Effect.Effect<void, WaysInPermissionRequiredError>;
  }
>()('@porcelain/access/AuthorizeWaysInService') {
  static readonly layer = Layer.effect(
    AuthorizeWaysInService,
    Effect.gen(function* () {
      const devices = yield* DeviceStore;

      return {
        execute: Effect.fn('AuthorizeWaysInService.execute')(function* (
          input: WaysInCaller,
        ): Effect.fn.Return<void, WaysInPermissionRequiredError> {
          const { viewer } = input;
          if (viewer.kind === 'owner') return;
          const device = yield* devices.find({ deviceId: viewer.deviceId });
          if (device !== undefined && deviceRevoked(device))
            return yield* Effect.fail(new WaysInPermissionRequiredError());
          if (input.local) return;
          if (
            device === undefined ||
            input.route === 'loopback' ||
            device.canEditWaysIn !== true
          )
            return yield* Effect.fail(new WaysInPermissionRequiredError());
        }),
      };
    }),
  );
}
