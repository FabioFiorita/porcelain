import {
  Cause,
  Context,
  Effect,
  Exit,
  Fiber,
  Layer,
  Option,
  RcMap,
  Ref,
  Schema,
  Scope,
  Semaphore,
} from 'effect';

export class WriteNotSentError extends Schema.TaggedError<WriteNotSentError>()(
  'WriteNotSentError',
  { cause: Schema.Unknown },
) {
  override get message() {
    return 'An earlier change failed, so this one was not sent.';
  }
}

type WriteAdmission = {
  readonly pending: number;
  readonly failure: Option.Option<unknown>;
};

export class WriteQueue extends Context.Service<
  WriteQueue,
  {
    readonly enqueue: <A, E, R>(
      operation: Effect.Effect<A, E, R>,
    ) => Effect.Effect<A, E | WriteNotSentError, R>;
  }
>()('@porcelain/client/WriteQueue') {
  static readonly make = Effect.gen(function* () {
    const permit = yield* Semaphore.make(1);
    const admission = yield* Ref.make<WriteAdmission>({
      pending: 0,
      failure: Option.none(),
    });
    return {
      enqueue: <A, E, R>(operation: Effect.Effect<A, E, R>) =>
        Effect.uninterruptibleMask((restore) =>
          Effect.gen(function* () {
            yield* Ref.update(admission, (current) => ({
              ...current,
              pending: current.pending + 1,
            }));
            yield* Effect.yieldNow;
            return yield* permit.withPermit(
              Effect.gen(function* () {
                const current = yield* Ref.get(admission);
                const work: Effect.Effect<A, E | WriteNotSentError, R> =
                  Option.isSome(current.failure)
                    ? Effect.fail(
                        new WriteNotSentError({ cause: current.failure.value }),
                      )
                    : operation;
                const result = yield* Effect.exit(restore(work));
                yield* Ref.update(admission, (current) => {
                  const pending = current.pending - 1;
                  const cause = Exit.isFailure(result)
                    ? Cause.squash(result.cause)
                    : undefined;
                  return {
                    pending,
                    failure:
                      pending === 0
                        ? Option.none()
                        : Option.orElse(current.failure, () =>
                            Exit.isFailure(result)
                              ? Option.some(
                                  cause instanceof WriteNotSentError
                                    ? cause.cause
                                    : cause,
                                )
                              : Option.none(),
                          ),
                  };
                });
                return yield* Exit.isSuccess(result)
                  ? Effect.succeed(result.value)
                  : Effect.failCause(result.cause);
              }),
            );
          }),
        ),
    };
  });
}

export class WriteQueues extends Context.Service<
  WriteQueues,
  {
    readonly run: <A, E, R>(
      key: readonly unknown[],
      operation: Effect.Effect<A, E, R>,
    ) => Effect.Effect<A, E | WriteNotSentError, R>;
  }
>()('@porcelain/client/WriteQueues') {
  static readonly layer = Layer.effect(
    WriteQueues,
    Effect.gen(function* () {
      const queues = yield* RcMap.make({
        lookup: (_key: string) =>
          Effect.gen(function* () {
            const scope = yield* Scope.fork(yield* Scope.Scope, 'parallel');
            const queue = yield* WriteQueue.make;
            return { scope, queue };
          }),
        idleTimeToLive: 0,
      });
      return {
        run: <A, E, R>(
          key: readonly unknown[],
          operation: Effect.Effect<A, E, R>,
        ) =>
          Effect.scoped(
            Effect.gen(function* () {
              const { scope, queue } = yield* RcMap.get(
                queues,
                JSON.stringify(key),
              );
              const work = yield* Effect.forkIn(
                queue.enqueue(operation),
                scope,
                { startImmediately: true },
              );
              return yield* Fiber.join(work).pipe(
                Effect.ensuring(Fiber.interrupt(work)),
              );
            }),
          ),
      };
    }),
  );
}
