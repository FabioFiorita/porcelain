import { Effect, Context, Layer } from 'effect';
import type {
  AuthorizeServiceUpdateInput,
  ServiceUpdateAuthority,
} from '../models/authorize-service-update.ts';
import { DeviceStore } from '../ports/device-store.ts';
import { deviceTrusted } from '../rules/device-activity.ts';

export class AuthorizeServiceUpdateService extends Context.Service<
  AuthorizeServiceUpdateService,
  {
    readonly execute: (
      input: AuthorizeServiceUpdateInput,
    ) => Effect.Effect<ServiceUpdateAuthority, never>;
  }
>()('@porcelain/access/AuthorizeServiceUpdateService') {
  static readonly layer = Layer.effect(
    AuthorizeServiceUpdateService,
    Effect.gen(function* () {
      const devices = yield* DeviceStore;

      return {
        execute: Effect.fn('AuthorizeServiceUpdateService.execute')(function* (
          input: AuthorizeServiceUpdateInput,
        ): Effect.fn.Return<ServiceUpdateAuthority, never> {
          const { viewer } = input;
          if (viewer.kind === 'owner' || input.local)
            return { canUpdate: true };
          return {
            canUpdate: deviceTrusted(
              yield* devices.find({ deviceId: viewer.deviceId }),
            ),
          };
        }),
      };
    }),
  );
}
