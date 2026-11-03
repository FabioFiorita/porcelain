import { Array as Arr, Effect, Layer, Schema } from 'effect';
import type { PushMessage, PushOutcome } from '@porcelain/access/models';
import { PushSender } from '@porcelain/access/ports';
import { HttpClient, HttpClientRequest, HttpClientResponse } from 'effect/http';

const ticketsSchema = Schema.Struct({
  data: Schema.Array(
    Schema.Union([
      Schema.Struct({ status: Schema.Literal('ok') }),
      Schema.Struct({
        status: Schema.Literal('error'),
        details: Schema.optional(
          Schema.Struct({ error: Schema.optional(Schema.String) }),
        ),
      }),
    ]),
  ),
});

const ANDROID_CHANNEL = 'reviews';

export const expoPushSenderLayer = (options: {
  endpoint: string;
  timeoutMs: number;
  batchSize: number;
}) =>
  Layer.effect(
    PushSender,
    Effect.gen(function* () {
      const client = yield* HttpClient.HttpClient;
      const sendBatch = Effect.fn('ExpoPushSender.sendBatch')(function* (
        messages: readonly PushMessage[],
      ): Effect.fn.Return<readonly PushOutcome[]> {
        const request = HttpClientRequest.post(options.endpoint).pipe(
          HttpClientRequest.acceptJson,
          HttpClientRequest.bodyJsonUnsafe(
            messages.map((message) => ({
              to: message.to,
              title: message.title,
              body: message.body,
              data: message.data,
              sound: 'default',
              channelId: ANDROID_CHANNEL,
            })),
          ),
        );
        const tickets = yield* client.execute(request).pipe(
          Effect.flatMap(HttpClientResponse.filterStatusOk),
          Effect.flatMap((response) => response.json),
          Effect.flatMap(Schema.decodeUnknownEffect(ticketsSchema)),
          Effect.map((answer) => answer.data),
          Effect.timeout(options.timeoutMs),
          Effect.catch(() => Effect.succeed(undefined)),
        );
        return messages.map((_, index): PushOutcome => {
          const ticket = tickets?.[index];
          if (ticket === undefined) return 'unsent';
          if (ticket.status === 'ok') return 'accepted';
          return ticket.details?.error === 'DeviceNotRegistered'
            ? 'unregistered'
            : 'rejected';
        });
      });
      return PushSender.of({
        send: Effect.fn('ExpoPushSender.send')(function* (
          messages: readonly PushMessage[],
        ) {
          const batches = yield* Effect.forEach(
            Arr.chunksOf(messages, options.batchSize),
            sendBatch,
          );
          return batches.flat();
        }),
      });
    }),
  );
