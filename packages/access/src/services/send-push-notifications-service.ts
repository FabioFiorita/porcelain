import { Effect, Context, Layer } from 'effect';
import type {
  PushDelivery,
  PushMessage,
} from '../models/push-notifications.ts';
import { PushSender } from '../ports/push-sender.ts';
import { pushDelivery } from '../rules/push-notifications.ts';

export class SendPushNotificationsService extends Context.Service<
  SendPushNotificationsService,
  {
    readonly execute: (
      messages: readonly PushMessage[],
    ) => Effect.Effect<PushDelivery>;
  }
>()('@porcelain/access/SendPushNotificationsService') {
  static readonly layer = Layer.effect(
    SendPushNotificationsService,
    Effect.gen(function* () {
      const sender = yield* PushSender;

      return {
        execute: Effect.fn('SendPushNotificationsService.execute')(function* (
          messages: readonly PushMessage[],
        ): Effect.fn.Return<PushDelivery> {
          if (messages.length === 0) return pushDelivery([], []);
          return pushDelivery(messages, yield* sender.send(messages));
        }),
      };
    }),
  );
}
