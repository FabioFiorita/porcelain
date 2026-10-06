import { Effect, Exit } from 'effect';

export function releaseInOrder(
  stages: readonly Effect.Effect<void>[],
): Effect.Effect<void> {
  return Effect.gen(function* () {
    const exits = yield* Effect.forEach(stages, Effect.exit, {
      concurrency: 1,
    });
    for (const exit of exits)
      if (Exit.isFailure(exit)) return yield* Effect.failCause(exit.cause);
  });
}
