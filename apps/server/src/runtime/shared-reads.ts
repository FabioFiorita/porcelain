import { Effect, Equal, Fiber, Hash, RcMap, Semaphore } from 'effect';

class ReadRequest<A, E> implements Equal.Equal {
  readonly key: string;
  readonly work: () => Effect.Effect<A, E>;
  constructor(key: string, work: () => Effect.Effect<A, E>) {
    this.key = key;
    this.work = work;
  }

  [Equal.symbol](other: Equal.Equal): boolean {
    return other instanceof ReadRequest && other.key === this.key;
  }

  [Hash.symbol](): number {
    return Hash.hash(this.key);
  }
}

export const makeSharedReads = <A, E = never>() =>
  Effect.gen(function* () {
    const admission = yield* Semaphore.make(1);
    let resources: RcMap.RcMap<ReadRequest<A, E>, Fiber.Fiber<A, E>>;
    resources = yield* RcMap.make({
      idleTimeToLive: 0,
      lookup: (request: ReadRequest<A, E>) =>
        Effect.forkScoped(
          Effect.suspend(request.work).pipe(
            Effect.ensuring(
              admission.withPermit(
                Effect.gen(function* () {
                  const keys = yield* RcMap.keys(resources);
                  if (Array.from(keys).some((key) => key === request))
                    yield* RcMap.invalidate(resources, request);
                }),
              ),
            ),
          ),
        ),
    });
    return {
      run: Effect.fn('SharedReads.run')(
        (key: string, work: () => Effect.Effect<A, E>) =>
          Effect.scoped(
            Effect.gen(function* () {
              const fiber = yield* admission.withPermit(
                RcMap.get(resources, new ReadRequest(key, work)),
              );
              return yield* Fiber.join(fiber);
            }),
          ),
      ),
    };
  });

export type SharedReads<A, E = never> = Effect.Success<
  ReturnType<typeof makeSharedReads<A, E>>
>;
