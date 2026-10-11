import { Effect } from 'effect';
import { AtomRef } from 'effect/reactivity';
import { WriteQueue } from '../../shared/api/write-queue.ts';
import { ConnectionError } from '../../shared/api/connection-error.ts';
export const persistedState = Effect.fn('persistedState')(function* <
  Snapshot extends object,
>(input: {
  initial: Snapshot;
  read: () => Effect.Effect<Snapshot, { readonly cause?: unknown }>;
  write: (
    snapshot: Snapshot,
  ) => Effect.Effect<void, { readonly cause?: unknown }>;
  messages: { beforeRead: string; readFailed: string; writeFailed: string };
}) {
  const state = AtomRef.make<
    Snapshot & {
      status: 'loading' | 'ready' | 'unreadable';
      error: string | undefined;
    }
  >({ ...input.initial, status: 'loading', error: undefined });
  const queue = yield* WriteQueue.make;
  return {
    state,
    load: () =>
      queue.enqueue(
        Effect.gen(function* () {
          state.update((current) => ({
            ...current,
            status: 'loading',
            error: undefined,
          }));
          yield* input.read().pipe(
            Effect.matchEffect({
              onSuccess: (snapshot) =>
                Effect.sync(() =>
                  state.set({ ...snapshot, status: 'ready', error: undefined }),
                ),
              onFailure: () =>
                Effect.sync(() =>
                  state.update((current) => ({
                    ...current,
                    status: 'unreadable',
                    error: input.messages.readFailed,
                  })),
                ),
            }),
            Effect.uninterruptible,
          );
        }),
      ),
    write: (
      update: (snapshot: Snapshot) => Effect.Effect<Snapshot, ConnectionError>,
    ) =>
      queue.enqueue(
        Effect.gen(function* () {
          if (state.value.status !== 'ready')
            return yield* Effect.fail(
              new ConnectionError({ message: input.messages.beforeRead }),
            );
          const snapshot = yield* update(state.value);
          yield* input.write(snapshot).pipe(
            Effect.mapError(
              ({ cause }) =>
                new ConnectionError({
                  message: input.messages.writeFailed,
                  cause,
                }),
            ),
            Effect.tapError(() =>
              Effect.sync(() =>
                state.update((current) => ({
                  ...current,
                  status: 'unreadable',
                  error: input.messages.writeFailed,
                })),
              ),
            ),
            Effect.tap(() =>
              Effect.sync(() =>
                state.update((current) => ({ ...current, ...snapshot })),
              ),
            ),
            Effect.uninterruptible,
          );
        }),
      ),
  };
});
