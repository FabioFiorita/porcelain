import { describe, expect, it } from 'vitest';
import { Effect, Exit, Queue } from 'effect';
import { nativeOperation } from '@porcelain/effects';
import { CoalescedWork } from './coalesced-work.ts';

async function held() {
  const started = await Effect.runPromise(
    Queue.unbounded<PromiseWithResolvers<void>>(),
  );
  let active = 0;
  let mostAtOnce = 0;
  let runs = 0;
  return {
    next: () => Effect.runPromise(Queue.take(started)),
    runs: () => runs,
    mostAtOnce: () => mostAtOnce,
    work: {
      execute: () =>
        nativeOperation(() => {
          const run = Promise.withResolvers<void>();
          runs += 1;
          active += 1;
          mostAtOnce = Math.max(mostAtOnce, active);
          Queue.offerUnsafe(started, run);
          return run.promise.finally(() => {
            active -= 1;
          });
        }),
    },
  };
}

describe('CoalescedWork', () => {
  it('runs the work once for a single request', async () => {
    const subject = await held();
    const refresh = new CoalescedWork(subject.work);
    try {
      const done = Effect.runPromise(refresh.execute());
      (await subject.next()).resolve();
      await done;
      expect(subject.runs()).toBe(1);
    } finally {
      await refresh.close();
    }
  });

  it('gives requests made during a run one shared following run', async () => {
    const subject = await held();
    const refresh = new CoalescedWork(subject.work);
    try {
      const first = Effect.runPromise(refresh.execute());
      const firstRun = await subject.next();
      let laterSettled = 0;
      const later = [1, 2, 3].map(() =>
        Effect.runPromise(refresh.execute()).then(() => {
          laterSettled += 1;
        }),
      );
      expect(subject.runs()).toBe(1);
      firstRun.resolve();
      await first;
      const following = await subject.next();
      expect({ runs: subject.runs(), laterSettled }).toEqual({
        runs: 2,
        laterSettled: 0,
      });
      following.resolve();
      await Promise.all(later);
      expect({
        runs: subject.runs(),
        mostAtOnce: subject.mostAtOnce(),
      }).toEqual({ runs: 2, mostAtOnce: 1 });
    } finally {
      await refresh.close();
    }
  });

  it('starts a new run for a request made after the last one settled', async () => {
    const subject = await held();
    const refresh = new CoalescedWork(subject.work);
    try {
      const first = Effect.runPromise(refresh.execute());
      (await subject.next()).resolve();
      await first;
      const second = Effect.runPromise(refresh.execute());
      (await subject.next()).resolve();
      await second;
      expect(subject.runs()).toBe(2);
    } finally {
      await refresh.close();
    }
  });

  it('preserves each failed run and allows a fresh following request', async () => {
    const subject = await held();
    const refresh = new CoalescedWork(subject.work);
    try {
      const first = Effect.runPromise(refresh.execute());
      const firstRun = await subject.next();
      const firstFailed = expect(first).rejects.toThrow('listing failed');
      const shared = Effect.runPromise(refresh.execute());
      const sharedFailed = expect(shared).rejects.toThrow(
        'listing failed again',
      );
      firstRun.reject(new Error('listing failed'));
      await firstFailed;
      (await subject.next()).reject(new Error('listing failed again'));
      await sharedFailed;
      const next = Effect.runPromise(refresh.execute());
      (await subject.next()).resolve();
      await next;
      expect(subject.runs()).toBe(3);
    } finally {
      await refresh.close();
    }
  });

  it('lets a cancelled caller leave while shared refresh work continues', async () => {
    const subject = await held();
    const refresh = new CoalescedWork(subject.work);
    try {
      const leaving = new AbortController();
      const cancelled = Effect.runPromiseExit(refresh.execute(), {
        signal: leaving.signal,
      });
      const firstRun = await subject.next();
      const staying = Effect.runPromise(refresh.execute());
      leaving.abort();
      expect(Exit.hasInterrupts(await cancelled)).toBe(true);
      firstRun.resolve();
      (await subject.next()).resolve();
      await staying;
      expect(subject.runs()).toBe(2);
    } finally {
      await refresh.close();
    }
  });
});
