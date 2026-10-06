import { Effect, Fiber, Scope, SynchronizedRef } from 'effect';
import type { JobRunner } from '../ports/job-runner.ts';

type Run<E> = {
  readonly identity: object;
  readonly fiber: Fiber.Fiber<void, E>;
};
type WorkState<E> = {
  readonly running?: Run<E> | undefined;
  readonly following?: Run<E> | undefined;
};

export const makeCoalescedWork = <E>(work: JobRunner<E>) =>
  Effect.gen(function* () {
    const scope = yield* Scope.Scope;
    const state = yield* SynchronizedRef.make<WorkState<E>>({});
    const start = Effect.fn('CoalescedWork.start')(function* (
      previous?: Run<E>,
    ) {
      const identity = {};
      const fiber = yield* Effect.forkIn(
        Effect.gen(function* () {
          if (previous) yield* Fiber.await(previous.fiber);
          yield* SynchronizedRef.update(state, (current) =>
            current.following?.identity === identity
              ? { running: current.following }
              : current,
          );
          yield* Effect.suspend(() => work.execute());
        }).pipe(
          Effect.ensuring(
            SynchronizedRef.update(state, (current) =>
              current.running?.identity === identity
                ? { following: current.following }
                : current,
            ),
          ),
        ),
        scope,
      );
      return { identity, fiber };
    });
    return {
      execute: Effect.fn('CoalescedWork.execute')(() =>
        SynchronizedRef.modifyEffect(state, (current) => {
          if (current.following)
            return Effect.succeed([current.following, current] as const);
          return Effect.map(
            start(current.running),
            (run) =>
              [
                run,
                current.running
                  ? { ...current, following: run }
                  : { running: run },
              ] as const,
          );
        }).pipe(
          Effect.uninterruptible,
          Effect.flatMap((run) => Fiber.join(run.fiber)),
        ),
      ),
    };
  });
