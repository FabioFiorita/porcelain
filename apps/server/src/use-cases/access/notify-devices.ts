import { Context, Effect, Layer } from 'effect';
import type { PushDelivery, PushEvent } from '@porcelain/access/models';
import {
  ForgetPushRegistrationsService,
  PlanPushNotificationsService,
  SendPushNotificationsService,
} from '@porcelain/access/services';
import { LaneKeys } from '../../runtime/lane-keys.ts';
import { Lanes } from '../../runtime/lanes.ts';

export class NotifyDevicesUseCase extends Context.Service<
  NotifyDevicesUseCase,
  {
    readonly execute: (event: PushEvent) => Effect.Effect<PushDelivery>;
  }
>()('@porcelain/server/NotifyDevicesUseCase') {
  static readonly layer = Layer.effect(
    NotifyDevicesUseCase,
    Effect.gen(function* () {
      const planCapability = yield* PlanPushNotificationsService;
      const sendCapability = yield* SendPushNotificationsService;
      const forgetCapability = yield* ForgetPushRegistrationsService;
      const lanesCapability = yield* Lanes;
      const laneKeysCapability = yield* LaneKeys;

      return {
        execute: Effect.fn('NotifyDevicesUseCase.execute')(function* (
          event: PushEvent,
        ): Effect.fn.Return<PushDelivery> {
          const messages = yield* lanesCapability.run(
            laneKeysCapability.access(),
            'read',
            () => planCapability.execute(event),
          );
          const delivery = yield* sendCapability.execute(messages);
          if (delivery.unregistered.length > 0)
            yield* lanesCapability.run(
              laneKeysCapability.access(),
              'write',
              () => forgetCapability.execute(delivery.unregistered),
            );
          yield* Effect.logInfo('Push notifications sent').pipe(
            Effect.annotateLogs({
              event: event.kind,
              accepted: delivery.accepted,
              rejected: delivery.rejected,
              unsent: delivery.unsent,
              unregistered: delivery.unregistered.length,
            }),
          );
          return delivery;
        }),
      };
    }),
  );
}
