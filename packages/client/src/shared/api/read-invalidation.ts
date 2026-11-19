import { Clock, Context, Deferred, Effect, FiberMap, Layer } from 'effect';
import { Reactivity } from 'effect/reactivity';
import {
  LIVE_READ_BATCH_MAX_MS,
  LIVE_READ_DEBOUNCE_MS,
} from '../../config/limits.ts';

export class ReadInvalidation extends Context.Service<
  ReadInvalidation,
  {
    readonly schedule: (
      keys: readonly unknown[],
    ) => Effect.Effect<Deferred.Deferred<void>>;
  }
>()('@porcelain/client/ReadInvalidation') {
  static readonly layer = Layer.effect(
    ReadInvalidation,
    Effect.gen(function* () {
      const reactivity = yield* Reactivity.Reactivity;
      const jobs = yield* FiberMap.make<'flush', void>();
      const empty = yield* Deferred.make<void>();
      yield* Deferred.succeed(empty, undefined);
      let pending:
        | {
            keys: unknown[];
            deadline: number;
            flushed: Deferred.Deferred<void>;
          }
        | undefined;
      return {
        schedule: Effect.fn('ReadInvalidation.schedule')(function* (
          keys: readonly unknown[],
        ) {
          if (keys.length === 0) return empty;
          const now = yield* Clock.currentTimeMillis;
          pending ??= {
            keys: [],
            deadline: now + LIVE_READ_BATCH_MAX_MS,
            flushed: Deferred.makeUnsafe(),
          };
          const batch = pending;
          batch.keys.push(...keys);
          yield* FiberMap.run(
            jobs,
            'flush',
            Effect.sleep(
              Math.min(
                LIVE_READ_DEBOUNCE_MS,
                Math.max(0, batch.deadline - now),
              ),
            ).pipe(
              Effect.interruptible,
              Effect.andThen(
                Effect.sync(() => {
                  pending = undefined;
                  reactivity.invalidateUnsafe(batch.keys);
                }).pipe(
                  Effect.onExit((exit) => Deferred.done(batch.flushed, exit)),
                ),
              ),
            ),
          );
          return batch.flushed;
        }, Effect.uninterruptible),
      };
    }),
  );
}
