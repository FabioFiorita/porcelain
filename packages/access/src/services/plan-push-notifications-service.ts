import { Effect, Context, Layer } from 'effect';
import type { PushEvent, PushMessage } from '../models/push-notifications.ts';
import { DeviceStore } from '../ports/device-store.ts';
import { PushRegistrationStore } from '../ports/push-registration-store.ts';
import { pushMessages } from '../rules/push-notifications.ts';

export class PlanPushNotificationsService extends Context.Service<
  PlanPushNotificationsService,
  {
    readonly execute: (
      event: PushEvent,
    ) => Effect.Effect<readonly PushMessage[]>;
  }
>()('@porcelain/access/PlanPushNotificationsService') {
  static readonly layer = Layer.effect(
    PlanPushNotificationsService,
    Effect.gen(function* () {
      const registrations = yield* PushRegistrationStore;
      const devices = yield* DeviceStore;

      return {
        execute: Effect.fn('PlanPushNotificationsService.execute')(function* (
          event: PushEvent,
        ): Effect.fn.Return<readonly PushMessage[]> {
          return pushMessages(
            event,
            yield* registrations.list(),
            yield* devices.list(),
          );
        }),
      };
    }),
  );
}
