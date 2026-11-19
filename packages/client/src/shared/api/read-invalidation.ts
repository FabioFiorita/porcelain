import {
  Clock,
  Context,
  Deferred,
  Effect,
  FiberMap,
  Layer,
  MutableHashSet,
} from 'effect';
import { Reactivity } from 'effect/reactivity';
import {
  LIVE_READ_BATCH_MAX_MS,
  LIVE_READ_DEBOUNCE_MS,
} from '../../config/limits.ts';

export const supersedingReadKey = (key: unknown) =>
  ['supersede-read', key] as const;

export class ReadInvalidation extends Context.Service<
  ReadInvalidation,
  {
    readonly refreshNow: (
      keys: readonly unknown[],
      superseding: readonly unknown[],
    ) => Effect.Effect<void>;
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
            keys: MutableHashSet.MutableHashSet<unknown>;
            deadline: number;
            flushed: Deferred.Deferred<void>;
          }
        | undefined;
      return {
        refreshNow: Effect.fn('ReadInvalidation.refreshNow')(
          (keys: readonly unknown[], superseding: readonly unknown[]) =>
            Effect.sync(() => {
              if (pending) {
                for (const key of keys)
                  MutableHashSet.remove(pending.keys, key);
                for (const key of superseding)
                  MutableHashSet.remove(pending.keys, key);
              }
              reactivity.invalidateUnsafe([
                ...keys,
                ...superseding.map(supersedingReadKey),
              ]);
            }),
        ),
        schedule: Effect.fn('ReadInvalidation.schedule')(function* (
          keys: readonly unknown[],
        ) {
          if (keys.length === 0) return empty;
          const now = yield* Clock.currentTimeMillis;
          pending ??= {
            keys: MutableHashSet.empty<unknown>(),
            deadline: now + LIVE_READ_BATCH_MAX_MS,
            flushed: Deferred.makeUnsafe(),
          };
          const batch = pending;
          for (const key of keys) MutableHashSet.add(batch.keys, key);
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
                  reactivity.invalidateUnsafe([...batch.keys]);
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
