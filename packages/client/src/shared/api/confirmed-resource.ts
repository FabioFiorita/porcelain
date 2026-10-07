import { Effect, Option, Stream, SubscriptionRef } from 'effect';
import { AsyncResult, Reactivity } from 'effect/reactivity';
import type { WorktreeConnection } from './connection.ts';
import type { ConnectionError } from './connection-error.ts';
import { currentAnswerEffect } from './stale-answer.ts';
import { queryKeys } from './query-keys.ts';
import { WriteQueues, type WriteNotSentError } from './write-queue.ts';

export type ConfirmedResource<A, E> = {
  readonly stream: Stream.Stream<
    AsyncResult.AsyncResult<A, E | ConnectionError>
  >;
  readonly confirm: <B, F, R>(
    operation: Effect.Effect<B, F, R>,
    change: (previous: Option.Option<A>, answer: B) => Option.Option<A>,
  ) => Effect.Effect<B, F | ConnectionError | WriteNotSentError, R>;
};

export function confirmedResource<A, E>(
  connection: WorktreeConnection,
  key: readonly unknown[],
  read: Effect.Effect<A, E>,
  seed: Option.Option<A> = Option.none(),
  readKeys: readonly unknown[] = [
    key,
    queryKeys.environment(connection.environmentId),
  ],
) {
  return Effect.gen(function* () {
    const queues = yield* WriteQueues;
    const reactivity = yield* Reactivity.Reactivity;
    const state = yield* SubscriptionRef.make<{
      readonly epoch: number;
      readonly result: AsyncResult.AsyncResult<A, E | ConnectionError>;
    }>({
      epoch: 0,
      result: Option.match(seed, {
        onNone: () => AsyncResult.initial<A, E | ConnectionError>(),
        onSome: (value) => AsyncResult.success<A, E | ConnectionError>(value),
      }),
    });
    const observe = Effect.gen(function* () {
      const epoch = (yield* SubscriptionRef.get(state)).epoch;
      yield* SubscriptionRef.update(state, (current) => ({
        ...current,
        result: AsyncResult.waiting(current.result),
      }));
      const answer = yield* Effect.exit(
        read.pipe(Effect.tap(() => currentAnswerEffect(connection))),
      );
      yield* SubscriptionRef.update(state, (current) =>
        current.epoch === epoch
          ? {
              ...current,
              result: AsyncResult.fromExitWithPrevious(
                answer,
                Option.some(current.result),
              ),
            }
          : current,
      );
    });
    function confirm<B, F, R>(
      operation: Effect.Effect<B, F, R>,
      change: (previous: Option.Option<A>, answer: B) => Option.Option<A>,
    ) {
      return queues.run(
        queryKeys.withIdentity(key, connection),
        Effect.gen(function* () {
          yield* currentAnswerEffect(connection);
          yield* SubscriptionRef.update(state, (current) => ({
            ...current,
            epoch: current.epoch + 1,
          }));
          const answer = yield* operation;
          yield* currentAnswerEffect(connection);
          yield* SubscriptionRef.update(state, (current) => ({
            epoch: current.epoch + 1,
            result: Option.match(
              change(AsyncResult.value(current.result), answer),
              {
                onNone: () => current.result,
                onSome: (value) => AsyncResult.success(value),
              },
            ),
          }));
          return answer;
        }).pipe(Effect.ensuring(reactivity.invalidate([key]))),
      );
    }
    return {
      confirm,
      stream: Stream.merge(
        SubscriptionRef.changes(state).pipe(
          Stream.map((current) => current.result),
        ),
        reactivity.stream(readKeys, observe).pipe(Stream.drain),
      ),
    } satisfies ConfirmedResource<A, E>;
  });
}
