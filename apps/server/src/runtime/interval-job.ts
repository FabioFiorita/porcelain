import {
  Cause,
  Duration,
  Effect,
  Exit,
  Schedule,
  Scope,
  SynchronizedRef,
} from 'effect';
import type { Logger } from '../ports/logger.ts';
import type { JobRunner } from '../ports/job-runner.ts';
import type { Job } from '../ports/job.ts';

type JobSchedule = {
  everyMs?: number | undefined;
  atStart?: boolean | undefined;
  atStop?: boolean | undefined;
};
type JobState = {
  readonly scope: Scope.Closeable;
  readonly stop: Effect.Effect<void>;
};

export const jobSequence = <E>(
  works: readonly JobRunner<E>[],
): JobRunner<E> => ({
  execute: Effect.fn('JobSequence.execute')(() =>
    Effect.forEach(works, (work) => work.execute(), {
      discard: true,
      concurrency: 1,
    }),
  ),
});

export const makeIntervalJob = <E>(
  name: string,
  work: JobRunner<E>,
  schedule: JobSchedule,
  logger: Logger,
) =>
  Effect.gen(function* () {
    const parent = yield* Scope.Scope;
    const state = yield* SynchronizedRef.make<JobState | undefined>(undefined);
    const attempt = Effect.fn('IntervalJob.attempt')(() =>
      Effect.suspend(() => work.execute()).pipe(
        Effect.catchCause((cause) =>
          Cause.hasInterruptsOnly(cause)
            ? Effect.interrupt
            : Effect.sync(() =>
                logger.failure({
                  kind: 'job',
                  job: name,
                  error: Cause.squash(cause),
                }),
              ),
        ),
      ),
    );
    const job: Job = {
      start: Effect.fn('IntervalJob.start')(() =>
        SynchronizedRef.modifyEffect(state, (current) => {
          if (current) return Effect.succeed([undefined, current] as const);
          return Effect.gen(function* () {
            const scope = yield* Scope.fork(parent);
            const stop = yield* Effect.cached(
              Effect.uninterruptible(
                Scope.close(scope, Exit.void).pipe(
                  Effect.andThen(schedule.atStop ? attempt() : Effect.void),
                  Effect.ensuring(
                    SynchronizedRef.update(state, (current) =>
                      current?.scope === scope ? undefined : current,
                    ),
                  ),
                ),
              ),
            );
            const everyMs = schedule.everyMs;
            if (schedule.atStart || everyMs !== undefined) {
              const repeated =
                everyMs === undefined
                  ? attempt()
                  : attempt().pipe(
                      Effect.repeat(Schedule.fixed(Duration.millis(everyMs))),
                      Effect.asVoid,
                    );
              const scheduled =
                schedule.atStart || everyMs === undefined
                  ? repeated
                  : Effect.delay(repeated, Duration.millis(everyMs));
              yield* Effect.forkIn(scheduled, scope, {
                startImmediately: true,
              });
            }
            return [undefined, { scope, stop }] as const;
          });
        }).pipe(Effect.uninterruptible, Effect.asVoid),
      ),
      stop: Effect.fn('IntervalJob.stop')(() =>
        SynchronizedRef.get(state).pipe(
          Effect.flatMap((current) => current?.stop ?? Effect.void),
        ),
      ),
    };
    yield* Effect.addFinalizer(() => job.stop());
    return job;
  });
