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

type QueuedPriority = 'background' | 'initial';
type ReadPriority = QueuedPriority | 'immediate';

export class ReadInvalidation extends Context.Service<
  ReadInvalidation,
  {
    readonly refreshNow: (keys: readonly unknown[]) => Effect.Effect<void>;
    readonly subscribe: (
      keys: readonly unknown[],
      onNotice: (priority: ReadPriority) => void,
    ) => () => void;
    readonly schedule: (
      keys: readonly unknown[],
      priority?: QueuedPriority,
    ) => Effect.Effect<Deferred.Deferred<void>>;
  }
>()('@porcelain/client/ReadInvalidation') {
  static refreshNow(keys: readonly unknown[]) {
    return this.use((invalidation) => invalidation.refreshNow(keys));
  }

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
            priority: QueuedPriority;
            deadline: number;
            flushed: Deferred.Deferred<void>;
          }
        | undefined;
      let priority: ReadPriority = 'background';
      const notify = (keys: readonly unknown[], next: ReadPriority) => {
        const previous = priority;
        priority = next;
        try {
          reactivity.invalidateUnsafe(keys);
        } finally {
          priority = previous;
        }
      };
      return {
        subscribe: (keys, onNotice) =>
          reactivity.registerUnsafe(keys, () => onNotice(priority)),
        refreshNow: Effect.fn('ReadInvalidation.refreshNow')(
          (keys: readonly unknown[]) =>
            Effect.sync(() => {
              if (pending)
                for (const key of keys)
                  MutableHashSet.remove(pending.keys, key);
              notify(keys, 'immediate');
            }),
        ),
        schedule: Effect.fn('ReadInvalidation.schedule')(function* (
          keys: readonly unknown[],
          priority: QueuedPriority = 'background',
        ) {
          if (keys.length === 0) return empty;
          const now = yield* Clock.currentTimeMillis;
          pending ??= {
            keys: MutableHashSet.empty<unknown>(),
            priority,
            deadline: now + LIVE_READ_BATCH_MAX_MS,
            flushed: Deferred.makeUnsafe(),
          };
          const batch = pending;
          if (priority === 'background') batch.priority = priority;
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
                  notify([...batch.keys], batch.priority);
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
