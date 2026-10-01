import { describe, expect, it } from 'vitest';
import { CoalescedWork } from './coalesced-work.ts';

function settle(): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, 10));
}

function held() {
  const runs: PromiseWithResolvers<void>[] = [];
  let active = 0;
  let mostAtOnce = 0;
  return {
    runs,
    mostAtOnce: () => mostAtOnce,
    work: {
      execute: async () => {
        const run = Promise.withResolvers<void>();
        runs.push(run);
        active += 1;
        mostAtOnce = Math.max(mostAtOnce, active);
        try {
          await run.promise;
        } finally {
          active -= 1;
        }
      },
    },
  };
}

describe('CoalescedWork', () => {
  it('runs the work once for a single request', async () => {
    const { runs, work } = held();
    const refresh = new CoalescedWork(work);
    const done = refresh.execute({});
    await settle();
    runs[0]?.resolve();
    await done;
    expect(runs).toHaveLength(1);
  });

  it('gives every request made during a run one shared run that starts after it', async () => {
    const { runs, work, mostAtOnce } = held();
    const refresh = new CoalescedWork(work);
    const first = refresh.execute({});
    await settle();
    let laterSettled = 0;
    const later = [
      refresh.execute({}),
      refresh.execute({}),
      refresh.execute({}),
    ];
    for (const request of later) void request.then(() => (laterSettled += 1));
    await settle();
    expect(runs).toHaveLength(1);
    runs[0]?.resolve();
    await first;
    await settle();
    expect({ runs: runs.length, laterSettled }).toEqual({
      runs: 2,
      laterSettled: 0,
    });
    runs[1]?.resolve();
    await Promise.all(later);
    expect({ runs: runs.length, mostAtOnce: mostAtOnce() }).toEqual({
      runs: 2,
      mostAtOnce: 1,
    });
  });

  it('starts a new run for a request made after the last one settled', async () => {
    const { runs, work } = held();
    const refresh = new CoalescedWork(work);
    const first = refresh.execute({});
    await settle();
    runs[0]?.resolve();
    await first;
    const second = refresh.execute({});
    await settle();
    runs[1]?.resolve();
    await second;
    expect(runs).toHaveLength(2);
  });

  it('fails the requests that shared a failed run, and runs again for the next request', async () => {
    const { runs, work } = held();
    const refresh = new CoalescedWork(work);
    const first = refresh.execute({});
    const shared = refresh.execute({});
    await settle();
    runs[0]?.reject(new Error('listing failed'));
    await expect(first).rejects.toThrow('listing failed');
    await settle();
    runs[1]?.reject(new Error('listing failed again'));
    await expect(shared).rejects.toThrow('listing failed again');
    const next = refresh.execute({});
    await settle();
    runs[2]?.resolve();
    await next;
    expect(runs).toHaveLength(3);
  });

  it('lets a cancelled request stop waiting while the run goes on for the others', async () => {
    const { runs, work } = held();
    const refresh = new CoalescedWork(work);
    const leaving = new AbortController();
    const cancelled = refresh.execute({ signal: leaving.signal });
    const staying = refresh.execute({});
    await settle();
    leaving.abort(new Error('client left'));
    await expect(cancelled).rejects.toThrow('client left');
    runs[0]?.resolve();
    await settle();
    runs[1]?.resolve();
    await staying;
    expect(runs).toHaveLength(2);
  });
});
