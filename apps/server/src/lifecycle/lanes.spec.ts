import { expect, it } from 'vitest';
import { ApplicationClosedError } from './errors/application-closed-error.ts';
import { Lanes } from './lanes.ts';

function held<T = void>() {
  let release!: (value: T) => void;
  let refuse!: (reason: unknown) => void;
  const promise = new Promise<T>((resolve, reject) => {
    release = resolve;
    refuse = reject;
  });
  return { promise, release, refuse };
}

const lanes = (readCapacity = 4) =>
  new Lanes({ readCapacity, deadlineMs: 30_000 });

it('runs reads of one repository side by side up to its capacity', async () => {
  const gate = lanes(4);
  const blocked = held();
  const started: number[] = [];
  const reads = [1, 2, 3, 4, 5].map((index) =>
    gate.run('repository', 'read', async () => {
      started.push(index);
      await blocked.promise;
    }),
  );
  await Promise.resolve();
  await Promise.resolve();
  expect(started).toEqual([1, 2, 3, 4]);
  blocked.release();
  await Promise.all(reads);
  expect(started).toEqual([1, 2, 3, 4, 5]);
});

it('never makes one repository wait for another', async () => {
  const gate = lanes(1);
  const hung = held();
  const slow = gate.run('one', 'read', () => hung.promise);
  expect(await gate.run('two', 'read', async () => 'answered')).toBe(
    'answered',
  );
  hung.release();
  await slow;
});

it('queues arriving reads behind a waiting write, so a write is never starved', async () => {
  const gate = lanes(2);
  const first = held();
  const order: string[] = [];
  const holding = gate.run('repository', 'read', async () => {
    order.push('read-1');
    await first.promise;
  });
  await Promise.resolve();
  const writing = gate.run('repository', 'write', async () => {
    order.push('write');
  });
  // Arrives after the write is already waiting, so it must not overtake it.
  const later = gate.run('repository', 'read', async () => {
    order.push('read-2');
  });
  first.release();
  await Promise.all([holding, writing, later]);
  expect(order).toEqual(['read-1', 'write', 'read-2']);
});

it('runs a write alone, excluding reads of the same repository', async () => {
  const gate = lanes(4);
  const writing = held();
  const order: string[] = [];
  const write = gate.run('repository', 'write', async () => {
    order.push('write-start');
    await writing.promise;
    order.push('write-end');
  });
  await Promise.resolve();
  const read = gate.run('repository', 'read', async () => {
    order.push('read');
  });
  writing.release();
  await Promise.all([write, read]);
  expect(order).toEqual(['write-start', 'write-end', 'read']);
});

it('starts the deadline when the work starts, not when it was asked for', async () => {
  const gate = new Lanes({ readCapacity: 1, deadlineMs: 60 });
  const blocked = held();
  const holding = gate.run('repository', 'read', () => blocked.promise, {
    deadlineMs: 5_000,
  });
  // Waits far longer than the deadline, then still receives a full budget.
  const cheap = gate.run('repository', 'read', async (admission) => {
    await new Promise((tick) => setTimeout(tick, 30));
    admission.signal.throwIfAborted();
    return 'answered';
  });
  await new Promise((tick) => setTimeout(tick, 150));
  blocked.release();
  await holding;
  expect(await cheap).toBe('answered');
});

it('removes a caller that leaves while queued instead of admitting it later', async () => {
  const gate = lanes(1);
  const blocked = held();
  const holding = gate.run('repository', 'read', () => blocked.promise);
  const leaving = new AbortController();
  let ran = false;
  const abandoned = gate.run(
    'repository',
    'read',
    async () => {
      ran = true;
    },
    { callerSignal: leaving.signal },
  );
  leaving.abort(new Error('client left'));
  await expect(abandoned).rejects.toThrow('client left');
  blocked.release();
  await holding;
  // The freed permit goes to real work, not to the caller that left.
  expect(await gate.run('repository', 'read', async () => 'answered')).toBe(
    'answered',
  );
  expect(ran).toBe(false);
});

it('refuses new work once closed', async () => {
  const gate = lanes(1);
  await gate.close();
  await expect(gate.run('repository', 'read', async () => 1)).rejects.toThrow(
    ApplicationClosedError,
  );
});

it('answers work with no lane while a repository read is in flight', async () => {
  const gate = lanes(1);
  const hung = held();
  const reading = gate.run('repository', 'read', () => hung.promise);
  // Database work never enters a lane, so it only checks the gate is open.
  gate.assertOpen();
  expect(await gate.run('filesystem', 'read', async () => 'browsed')).toBe(
    'browsed',
  );
  hung.release();
  await reading;
});

it('stops a read whose caller leaves, even when the work ignores its signal', async () => {
  const gate = lanes(4);
  const never = held();
  const leaving = new AbortController();
  let observed = false;
  const read = gate.run(
    'repository',
    'read',
    ({ signal }) => {
      signal.addEventListener('abort', () => {
        observed = true;
      });
      return never.promise;
    },
    { callerSignal: leaving.signal },
  );
  // Let the read start, so this is abandonment rather than a refused entry.
  await Promise.resolve();
  await Promise.resolve();
  leaving.abort(new Error('client left'));
  await expect(read).rejects.toThrow('client left');
  // The work is told, and the caller is not left waiting for it either way.
  expect(observed).toBe(true);
  never.release();
});

it('keeps a started write going after its caller leaves', async () => {
  const gate = lanes(4);
  const writing = held();
  let finished = false;
  const leaving = new AbortController();
  const write = gate.run(
    'repository',
    'write',
    async () => {
      await writing.promise;
      finished = true;
    },
    { callerSignal: leaving.signal, untilSettled: true },
  );
  await Promise.resolve();
  leaving.abort(new Error('client left'));
  writing.release();
  await write;
  // A half-recorded action is worse than a slow one.
  expect(finished).toBe(true);
});

it('admits a queued write when a queued read is ahead of it', async () => {
  const gate = lanes(1);
  const first = held();
  const order: string[] = [];
  const holding = gate.run('repository', 'read', async () => {
    order.push('read-1');
    await first.promise;
  });
  await Promise.resolve();
  // The read queues first: a single queue with a writer-preference rule
  // refuses this read and never reaches the write behind it.
  const queuedRead = gate.run('repository', 'read', async () => {
    order.push('read-2');
  });
  const queuedWrite = gate.run('repository', 'write', async () => {
    order.push('write');
  });
  first.release();
  await Promise.all([holding, queuedRead, queuedWrite]);
  expect(order).toEqual(['read-1', 'write', 'read-2']);
});

it('lets queued reads through when the write they were waiting behind is cancelled', async () => {
  const gate = lanes(1);
  const first = held();
  const holding = gate.run('repository', 'read', () => first.promise);
  await Promise.resolve();
  const leaving = new AbortController();
  const queuedRead = gate.run('repository', 'read', async () => 'answered');
  const cancelledWrite = gate.run(
    'repository',
    'write',
    async () => 'written',
    { callerSignal: leaving.signal },
  );
  leaving.abort(new Error('client left'));
  await expect(cancelledWrite).rejects.toThrow('client left');
  first.release();
  await holding;
  expect(await queuedRead).toBe('answered');
});

it('keeps the permit until cancelled work has actually stopped', async () => {
  const gate = lanes(4);
  const never = held();
  const leaving = new AbortController();
  const read = gate.run(
    'repository',
    'read',
    async () => {
      // Ignores its signal, as a Git child that has not yet died would.
      await never.promise;
    },
    { callerSignal: leaving.signal },
  );
  await Promise.resolve();
  await Promise.resolve();
  leaving.abort(new Error('client left'));
  await expect(read).rejects.toThrow('client left');
  let written = false;
  const write = gate.run('repository', 'write', async () => {
    written = true;
  });
  await new Promise((tick) => setTimeout(tick, 20));
  // Exclusion is not released by the caller leaving, only by the work stopping.
  expect(written).toBe(false);
  never.release();
  await write;
  expect(written).toBe(true);
});

it('does not keep a permit when the work throws before it starts', async () => {
  const gate = lanes(1);
  await expect(
    gate.run('repository', 'read', () => {
      throw new Error('bad request');
    }),
  ).rejects.toThrow('bad request');
  expect(await gate.run('repository', 'read', async () => 'answered')).toBe(
    'answered',
  );
});

it('waits for work that must finish before releasing its resources', async () => {
  const holding = held();
  let released = false;
  const gate = new Lanes({
    readCapacity: 1,
    deadlineMs: 30_000,
    closeResources: () => {
      released = true;
    },
  });
  let finished = false;
  void gate.finish(async () => {
    await holding.promise;
    finished = true;
  });
  const closing = gate.close();
  await new Promise((tick) => setTimeout(tick, 20));
  // Closing cannot drop work that was accepted before the lane refused it.
  expect(released).toBe(false);
  holding.release();
  await closing;
  expect(finished).toBe(true);
  expect(released).toBe(true);
});
