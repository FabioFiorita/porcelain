import { expect, it } from 'vitest';
import { SharedReads } from './shared-reads.ts';

function held<T>() {
  let release!: (value: T) => void;
  let refuse!: (reason: unknown) => void;
  const promise = new Promise<T>((resolve, reject) => {
    release = resolve;
    refuse = reject;
  });
  return { promise, release, refuse };
}

it('answers identical reads in flight with one piece of work', async () => {
  const shared = new SharedReads();
  const blocked = held<string>();
  let runs = 0;
  const work = () => {
    runs += 1;
    return blocked.promise;
  };
  const first = shared.run('status\0/repo', work);
  const second = shared.run('status\0/repo', work);
  blocked.release('answered');
  expect(await Promise.all([first, second])).toEqual(['answered', 'answered']);
  expect(runs).toBe(1);
  expect(shared.size).toBe(0);
});

it('keeps different inputs apart', async () => {
  const shared = new SharedReads();
  let runs = 0;
  const work = async () => {
    runs += 1;
    return runs;
  };
  await Promise.all([
    shared.run('status\0/repo', work),
    shared.run('diff\0/repo\0file.ts', work),
  ]);
  expect(runs).toBe(2);
});

it('does not cancel work another caller is still waiting for', async () => {
  const shared = new SharedReads();
  const blocked = held<string>();
  let aborted = false;
  const leaving = new AbortController();
  const work = (signal: AbortSignal) => {
    signal.addEventListener('abort', () => {
      aborted = true;
    });
    return blocked.promise;
  };
  const abandoned = shared.run('status\0/repo', work, leaving.signal);
  const staying = shared.run('status\0/repo', work);
  leaving.abort(new Error('client left'));
  await expect(abandoned).rejects.toThrow('client left');
  expect(aborted).toBe(false);
  blocked.release('answered');
  expect(await staying).toBe('answered');
});

it('stops the work when the last caller leaves', async () => {
  const shared = new SharedReads();
  const blocked = held<string>();
  let aborted = false;
  const leaving = new AbortController();
  const abandoned = shared.run(
    'status\0/repo',
    (signal) => {
      signal.addEventListener('abort', () => {
        aborted = true;
      });
      return blocked.promise;
    },
    leaving.signal,
  );
  leaving.abort(new Error('client left'));
  await expect(abandoned).rejects.toThrow('client left');
  expect(aborted).toBe(true);
});

it('shares a failure with those attached and lets a later caller retry', async () => {
  const shared = new SharedReads();
  const failing = held<string>();
  let runs = 0;
  const work = () => {
    runs += 1;
    return failing.promise;
  };
  const first = shared.run('status\0/repo', work);
  const second = shared.run('status\0/repo', work);
  failing.refuse(new Error('unreadable'));
  await expect(first).rejects.toThrow('unreadable');
  await expect(second).rejects.toThrow('unreadable');
  expect(runs).toBe(1);
  expect(await shared.run('status\0/repo', async () => 'answered')).toBe(
    'answered',
  );
});
