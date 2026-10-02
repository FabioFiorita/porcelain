import { describe, expect, it } from 'vitest';
import { IntervalJob } from './interval-job.ts';

function settle(ms = 20): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function reporting() {
  const reports: unknown[] = [];
  return {
    reports,
    logger: { failure: (report: unknown) => reports.push(report) },
  };
}

function counting(
  work: (signal: AbortSignal) => Promise<void> = async () => undefined,
) {
  const runs: AbortSignal[] = [];
  return {
    runs,
    work: {
      execute: async (context: { signal?: AbortSignal | undefined }) => {
        const signal = context.signal ?? new AbortController().signal;
        runs.push(signal);
        await work(signal);
      },
    },
  };
}

describe('IntervalJob', () => {
  it('runs its work once when it starts, if scheduled at start', async () => {
    const { runs, work } = counting();
    const job = new IntervalJob(
      'job',
      work,
      { atStart: true },
      reporting().logger,
    );
    job.start();
    await settle();
    await job.stop();
    expect(runs).toHaveLength(1);
  });

  it('runs its work again on every interval', async () => {
    const { runs, work } = counting();
    const job = new IntervalJob(
      'job',
      work,
      { everyMs: 2 },
      reporting().logger,
    );
    job.start();
    await settle(40);
    await job.stop();
    expect(runs.length).toBeGreaterThanOrEqual(2);
  });

  it('never starts a run while the previous one is still going', async () => {
    const release = Promise.withResolvers<void>();
    const { runs, work } = counting(() => release.promise);
    const job = new IntervalJob(
      'job',
      work,
      { atStart: true, everyMs: 2 },
      reporting().logger,
    );
    job.start();
    await settle(40);
    release.resolve();
    await job.stop();
    expect(runs).toHaveLength(1);
  });

  it('aborts the running work when it stops and waits for it to settle', async () => {
    const settled = { value: false };
    const { runs, work } = counting(
      (signal) =>
        new Promise<void>((resolve) =>
          signal.addEventListener('abort', () => {
            settled.value = true;
            resolve();
          }),
        ),
    );
    const job = new IntervalJob(
      'job',
      work,
      { atStart: true },
      reporting().logger,
    );
    job.start();
    await job.stop();
    expect([runs[0]?.aborted, settled.value]).toEqual([true, true]);
  });

  it('reports a failing run to the logger under its name', async () => {
    const failure = new Error('refresh failed');
    const { reports, logger } = reporting();
    const { work } = counting(() => Promise.reject(failure));
    const job = new IntervalJob(
      'refresh-inventory',
      work,
      { atStart: true },
      logger,
    );
    job.start();
    await settle();
    await job.stop();
    expect(reports).toEqual([
      { kind: 'job', job: 'refresh-inventory', error: failure },
    ]);
  });

  it('does not report a run that failed because it was stopped', async () => {
    const { reports, logger } = reporting();
    const { work } = counting(
      (signal) =>
        new Promise<void>((_resolve, reject) =>
          signal.addEventListener('abort', () => reject(signal.reason)),
        ),
    );
    const job = new IntervalJob('job', work, { atStart: true }, logger);
    job.start();
    await job.stop();
    expect(reports).toEqual([]);
  });

  it('runs a final time with a live signal when it stops, if scheduled at stop', async () => {
    const { runs, work } = counting();
    const job = new IntervalJob(
      'job',
      work,
      { atStop: true },
      reporting().logger,
    );
    job.start();
    await job.stop();
    expect(runs.map((signal) => signal.aborted)).toEqual([false]);
  });
});
