import { Cause, Deferred, Effect, Exit, Schema } from 'effect';

export class WriteNotSentError extends Schema.TaggedError<WriteNotSentError>()(
  'WriteNotSentError',
  { cause: Schema.Unknown },
) {
  override get message() {
    return 'An earlier change failed, so this one was not sent.';
  }
}

export function createWriteQueue(onDrained?: () => void) {
  let tail: Deferred.Deferred<Exit.Exit<unknown, unknown>> | undefined;

  return {
    enqueue<A, E>(
      operation: Effect.Effect<A, E>,
    ): Effect.Effect<A, E | WriteNotSentError> {
      return Effect.uninterruptibleMask((restore) =>
        Effect.gen(function* () {
          const previous = tail;
          const completed = Deferred.makeUnsafe<Exit.Exit<unknown, unknown>>();
          tail = completed;
          yield* Effect.yieldNow;
          const preceding = previous
            ? yield* Deferred.await(previous)
            : Exit.void;
          const work: Effect.Effect<A, E | WriteNotSentError> = Exit.isSuccess(
            preceding,
          )
            ? operation
            : Effect.fail(
                new WriteNotSentError({
                  cause: (() => {
                    const cause = Cause.squash(preceding.cause);
                    return cause instanceof WriteNotSentError
                      ? cause.cause
                      : cause;
                  })(),
                }),
              );
          const result = yield* Effect.exit(restore(work));
          yield* Deferred.succeed(completed, result);
          if (tail === completed) {
            tail = undefined;
            onDrained?.();
          }
          return yield* Exit.isSuccess(result)
            ? Effect.succeed(result.value)
            : Effect.failCause(result.cause);
        }),
      );
    },
  };
}

export function createScopedWriteQueues() {
  const owners = new WeakMap<
    object,
    Map<string, ReturnType<typeof createWriteQueue>>
  >();
  return (owner: object, key: readonly unknown[]) => {
    const hash = JSON.stringify(key);
    return {
      enqueue<A, E>(operation: Effect.Effect<A, E>) {
        return Effect.suspend(() => {
          let queues = owners.get(owner);
          if (!queues) {
            queues = new Map();
            owners.set(owner, queues);
          }
          let queue = queues.get(hash);
          if (!queue) {
            const activeQueues = queues;
            queue = createWriteQueue(() => activeQueues.delete(hash));
            queues.set(hash, queue);
          }
          return queue.enqueue(operation);
        });
      },
    };
  };
}
