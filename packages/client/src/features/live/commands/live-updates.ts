import { Cause, Context, Effect, Queue, Result, Schema } from 'effect';
import { Socket } from 'effect/socket';
import { ScopedTasks, withSignal } from '@porcelain/effects';
import { liveNoticeSchema } from '@porcelain/contracts/access';
import { RequestError } from '../../../shared/api/request-error.ts';
import type { LiveSubscription, LiveUpdatePort } from '../ports/live-update.ts';
import {
  LIVE_ACCESS_REVOKED_CLOSE_CODE,
  LIVE_RECONNECT_BACKOFF,
  LIVE_RECONNECT_FIRST_MS,
  LIVE_RECONNECT_MAX_MS,
  LIVE_SUBSCRIPTION_BUFFER,
} from '../../../config/limits.ts';

const decodeNotice = Schema.decodeUnknownResult(
  Schema.fromJsonString(liveNoticeSchema),
);

function unauthorized(error: unknown) {
  return (
    (error instanceof RequestError && error.status === 401) ||
    (Socket.isSocketError(error) &&
      error.reason._tag === 'SocketCloseError' &&
      error.reason.code === LIVE_ACCESS_REVOKED_CLOSE_CODE)
  );
}

export function createLiveUpdates<E>(
  open: Effect.Effect<Socket.Socket, E>,
  context: Context.Context<never> = Context.empty(),
): LiveUpdatePort {
  return {
    connect({ signal, onNotice, onReconnect, onUnauthorized }) {
      const tasks = new ScopedTasks(context);
      let subscription: LiveSubscription = {
        type: 'subscribe',
        projects: [],
        worktrees: [],
      };
      const updates = Effect.runSync(
        Queue.sliding<LiveSubscription>(LIVE_SUBSCRIPTION_BUFFER),
      );
      let readyCount = 0;
      let retryMs = LIVE_RECONNECT_FIRST_MS;
      const connection = Effect.scoped(
        Effect.gen(function* () {
          const socket = yield* open;
          const current = yield* socket.writer;
          const pull = yield* Socket.readerString(socket);
          const receive = Effect.gen(function* () {
            while (true) {
              const frames = yield* pull;
              for (const frame of frames) {
                const notice = decodeNotice(frame);
                if (Result.isFailure(notice)) continue;
                if (notice.success.type === 'ready') {
                  if (readyCount > 0) onReconnect();
                  readyCount += 1;
                  retryMs = LIVE_RECONNECT_FIRST_MS;
                  yield* current.write(JSON.stringify(subscription));
                }
                onNotice(notice.success);
              }
            }
          });
          const send = Effect.forever(
            Effect.flatMap(Queue.take(updates), (value) =>
              current.write(JSON.stringify(value)),
            ),
          );
          yield* Effect.all([receive, send], { concurrency: 'unbounded' });
        }),
      );
      const session = Effect.gen(function* () {
        while (true) {
          const result = yield* Effect.result(connection);
          if (Result.isFailure(result) && unauthorized(result.failure)) {
            onUnauthorized();
            return;
          }
          yield* Effect.sleep(retryMs);
          retryMs = Math.min(
            retryMs * LIVE_RECONNECT_BACKOFF,
            LIVE_RECONNECT_MAX_MS,
          );
        }
      });
      void tasks
        .run(
          withSignal(session, signal).pipe(
            Effect.catchCause((cause) =>
              Cause.hasInterrupts(cause)
                ? Effect.void
                : Effect.logError('Live updates stopped unexpectedly'),
            ),
          ),
        )
        .then(() => {
          Queue.shutdownUnsafe(updates);
          return Effect.runPromise(tasks.close());
        });
      return {
        subscribe(value) {
          if (signal.aborted) return;
          subscription = value;
          Queue.offerUnsafe(updates, value);
        },
      };
    },
  };
}
