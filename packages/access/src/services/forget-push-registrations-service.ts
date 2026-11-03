import { Effect, Context, Layer } from 'effect';
import type { PushTokenKey } from '../models/push-notifications.ts';
import { PushRegistrationStore } from '../ports/push-registration-store.ts';
import { unregisteredDevices } from '../rules/push-notifications.ts';

export class ForgetPushRegistrationsService extends Context.Service<
  ForgetPushRegistrationsService,
  {
    readonly execute: (tokens: readonly PushTokenKey[]) => Effect.Effect<void>;
  }
>()('@porcelain/access/ForgetPushRegistrationsService') {
  static readonly layer = Layer.effect(
    ForgetPushRegistrationsService,
    Effect.gen(function* () {
      const registrations = yield* PushRegistrationStore;

      return {
        execute: Effect.fn('ForgetPushRegistrationsService.execute')(function* (
          tokens: readonly PushTokenKey[],
        ): Effect.fn.Return<void> {
          const stale = unregisteredDevices(
            yield* registrations.list(),
            tokens,
          );
          for (const deviceId of stale)
            yield* registrations.remove({ deviceId });
        }),
      };
    }),
  );
}
