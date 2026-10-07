import { describe, expect, it } from '@effect/vitest';
import { Deferred, Duration, Effect, Fiber } from 'effect';
import { TestClock } from 'effect/testing';
import { makeIntervalJob } from './interval-job.ts';
import { Observability } from './observability.ts';

function reporting() {
  const reports: unknown[] = [];
  return {
    reports,
    logger: {
      failure: (report: unknown) => {
        reports.push(report);
      },
    },
  };
}

function counting(work: Effect.Effect<void> = Effect.void) {
  const runs: number[] = [];
  return {
    runs,
    work: {
      execute: () =>
        Effect.sync(() => {
          runs.push(runs.length);
        }).pipe(Effect.andThen(work)),
    },
  };
}

describe('IntervalJob', () => {
  it.effect('runs once at start when scheduled at start', () =>
    Effect.gen(function* () {
      const { runs, work } = counting();
      const job = yield* makeIntervalJob(
        'job',
        work,
        { atStart: true },
        reporting().logger,
        yield* Observability.pipe(Effect.provide(Observability.layer)),
      );
      yield* job.start();
      yield* job.stop();
      expect(runs).toHaveLength(1);
    }),
  );

  it.effect('starts at the first deadline and repeats at a fixed cadence', () =>
    Effect.gen(function* () {
      const { runs, work } = counting();
      const job = yield* makeIntervalJob(
        'job',
        work,
        { every: Duration.seconds(1) },
        reporting().logger,
        yield* Observability.pipe(Effect.provide(Observability.layer)),
      );
      yield* Effect.addFinalizer(() => job.stop());
      yield* job.start();
      yield* TestClock.adjust(999);
      expect(runs).toHaveLength(0);
      yield* TestClock.adjust(1);
      expect(runs).toHaveLength(1);
      yield* TestClock.adjust(2000);
      expect(runs).toHaveLength(3);
    }),
  );

  it.effect('never overlaps a run even when multiple deadlines pass', () =>
    Effect.gen(function* () {
      const release = yield* Deferred.make<void>();
      const { runs, work } = counting(Deferred.await(release));
      const job = yield* makeIntervalJob(
        'job',
        work,
        { atStart: true, every: Duration.seconds(1) },
        reporting().logger,
        yield* Observability.pipe(Effect.provide(Observability.layer)),
      );
      yield* job.start();
      yield* TestClock.adjust(4000);
      expect(runs).toHaveLength(1);
      yield* Deferred.succeed(release, undefined);
      yield* job.stop();
    }),
  );

  it.effect(
    'aborts running work and holds stop until its native cleanup settles',
    () =>
      Effect.gen(function* () {
        const aborted = yield* Deferred.make<void>();
        const cleanup = yield* Deferred.make<void>();
        const { runs, work } = counting(
          Effect.never.pipe(
            Effect.ensuring(
              Deferred.succeed(aborted, undefined).pipe(
                Effect.andThen(Deferred.await(cleanup)),
              ),
            ),
          ),
        );
        const job = yield* makeIntervalJob(
          'job',
          work,
          { atStart: true },
          reporting().logger,
          yield* Observability.pipe(Effect.provide(Observability.layer)),
        );
        yield* job.start();
        let stopped = false;
        const stopping = yield* Effect.forkChild(
          job.stop().pipe(
            Effect.tap(
              Effect.sync(() => {
                stopped = true;
              }),
            ),
          ),
        );
        yield* Deferred.await(aborted);
        expect(runs).toHaveLength(1);
        expect(stopped).toBe(false);
        yield* Deferred.succeed(cleanup, undefined);
        yield* Fiber.join(stopping);
        expect(stopped).toBe(true);
      }),
  );

  it.effect('reports a failing run under its job name', () =>
    Effect.gen(function* () {
      const failure = new Error('refresh failed');
      const { reports, logger } = reporting();
      const work = { execute: () => Effect.fail(failure) };
      const job = yield* makeIntervalJob(
        'refresh-inventory',
        work,
        { atStart: true },
        logger,
        yield* Observability.pipe(Effect.provide(Observability.layer)),
      );
      yield* job.start();
      yield* job.stop();
      expect(reports).toEqual([
        { kind: 'job', job: 'refresh-inventory', error: failure },
      ]);
    }),
  );

  it.effect('does not report interruption caused by stopping', () =>
    Effect.gen(function* () {
      const { reports, logger } = reporting();
      const job = yield* makeIntervalJob(
        'job',
        { execute: () => Effect.never },
        { atStart: true },
        logger,
        yield* Observability.pipe(Effect.provide(Observability.layer)),
      );
      yield* job.start();
      yield* job.stop();
      expect(reports).toEqual([]);
    }),
  );

  it.effect('runs once at stop without interruption', () =>
    Effect.gen(function* () {
      const { runs, work } = counting();
      const job = yield* makeIntervalJob(
        'job',
        work,
        { atStop: true },
        reporting().logger,
        yield* Observability.pipe(Effect.provide(Observability.layer)),
      );
      yield* job.start();
      yield* job.stop();
      expect(runs).toEqual([0]);
    }),
  );
  it.effect('starts once, shares stop and can start fresh after stopping', () =>
    Effect.gen(function* () {
      const { runs, work } = counting();
      const job = yield* makeIntervalJob(
        'job',
        work,
        { atStart: true, atStop: true },
        reporting().logger,
        yield* Observability.pipe(Effect.provide(Observability.layer)),
      );
      yield* job.start();
      yield* job.start();
      yield* Effect.all([job.stop(), job.stop()], { concurrency: 2 });
      expect(runs).toHaveLength(2);
      yield* job.start();
      yield* job.stop();
      expect(runs).toHaveLength(4);
    }),
  );
});
