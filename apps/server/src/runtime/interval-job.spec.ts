import { describe, expect, it } from '@effect/vitest';
import { Effect } from 'effect';
import { TestClock } from 'effect/testing';
import { nativeOperation } from '@porcelain/effects';
import { IntervalJob } from './interval-job.ts';

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

function counting(
  work: (signal: AbortSignal) => Promise<void> = () => Promise.resolve(),
) {
  const runs: AbortSignal[] = [];
  return {
    runs,
    work: {
      execute: () =>
        nativeOperation((signal) => {
          runs.push(signal);
          return work(signal);
        }),
    },
  };
}

describe('IntervalJob', () => {
  it.effect('runs once at start when scheduled at start', () =>
    Effect.gen(function* () {
      const { runs, work } = counting();
      const job = new IntervalJob(
        'job',
        work,
        { atStart: true },
        reporting().logger,
        yield* Effect.context(),
      );
      job.start();
      yield* Effect.promise(() => job.stop());
      expect(runs).toHaveLength(1);
    }),
  );

  it.effect('starts at the first deadline and repeats at a fixed cadence', () =>
    Effect.gen(function* () {
      const { runs, work } = counting();
      const job = new IntervalJob(
        'job',
        work,
        { everyMs: 1000 },
        reporting().logger,
        yield* Effect.context(),
      );
      yield* Effect.addFinalizer(() => Effect.promise(() => job.stop()));
      job.start();
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
      const release = Promise.withResolvers<void>();
      const { runs, work } = counting(() => release.promise);
      const job = new IntervalJob(
        'job',
        work,
        { atStart: true, everyMs: 1000 },
        reporting().logger,
        yield* Effect.context(),
      );
      job.start();
      yield* TestClock.adjust(4000);
      expect(runs).toHaveLength(1);
      release.resolve();
      yield* Effect.promise(() => job.stop());
    }),
  );

  it.effect(
    'aborts running work and holds stop until its native cleanup settles',
    () =>
      Effect.gen(function* () {
        const aborted = Promise.withResolvers<void>();
        const cleanup = Promise.withResolvers<void>();
        const { runs, work } = counting((signal) => {
          signal.addEventListener('abort', () => aborted.resolve(), {
            once: true,
          });
          return cleanup.promise;
        });
        const job = new IntervalJob(
          'job',
          work,
          { atStart: true },
          reporting().logger,
          yield* Effect.context(),
        );
        job.start();
        let stopped = false;
        const stopping = job.stop().then(() => {
          stopped = true;
        });
        yield* Effect.promise(() => aborted.promise);
        expect(runs[0]?.aborted).toBe(true);
        expect(stopped).toBe(false);
        cleanup.resolve();
        yield* Effect.promise(() => stopping);
        expect(stopped).toBe(true);
      }),
  );

  it.effect('reports a failing run under its job name', () =>
    Effect.gen(function* () {
      const failure = new Error('refresh failed');
      const { reports, logger } = reporting();
      const work = { execute: () => Effect.fail(failure) };
      const job = new IntervalJob(
        'refresh-inventory',
        work,
        { atStart: true },
        logger,
        yield* Effect.context(),
      );
      job.start();
      yield* Effect.promise(() => job.stop());
      expect(reports).toEqual([
        { kind: 'job', job: 'refresh-inventory', error: failure },
      ]);
    }),
  );

  it.effect('does not report interruption caused by stopping', () =>
    Effect.gen(function* () {
      const { reports, logger } = reporting();
      const job = new IntervalJob(
        'job',
        { execute: () => Effect.never },
        { atStart: true },
        logger,
        yield* Effect.context(),
      );
      job.start();
      yield* Effect.promise(() => job.stop());
      expect(reports).toEqual([]);
    }),
  );

  it.effect('runs once at stop with a live native signal', () =>
    Effect.gen(function* () {
      const { runs, work } = counting();
      const job = new IntervalJob(
        'job',
        work,
        { atStop: true },
        reporting().logger,
        yield* Effect.context(),
      );
      job.start();
      yield* Effect.promise(() => job.stop());
      expect(runs.map((signal) => signal.aborted)).toEqual([false]);
    }),
  );
});
