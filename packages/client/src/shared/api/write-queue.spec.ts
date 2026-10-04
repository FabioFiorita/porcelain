import { describe, expect, it } from 'vitest';
import { createWriteQueue, createScopedWriteQueues } from './write-queue.ts';

describe('serial writes', () => {
  it('starts the next write only after the preceding write completes', async () => {
    const queue = createWriteQueue();
    const steps: string[] = [];
    let finish = () => {};
    const gate = new Promise<void>((resolve) => {
      finish = resolve;
    });
    const first = queue.enqueue(async () => {
      steps.push('first started');
      await gate;
      steps.push('first completed');
      return 'first';
    });
    const second = queue.enqueue(async () => {
      steps.push('second started');
      return 'second';
    });
    await Promise.resolve();
    expect(steps).toEqual(['first started']);
    finish();
    expect(await Promise.all([first, second])).toEqual(['first', 'second']);
    expect(steps).toEqual([
      'first started',
      'first completed',
      'second started',
    ]);
  });

  it('rejects every already queued write after a failure without starting it', async () => {
    const queue = createWriteQueue();
    const failure = new Error('The file changed since it was shown.');
    const started: string[] = [];
    const first = queue.enqueue(() => Promise.reject(failure));
    const second = queue.enqueue(async () => {
      started.push('second');
    });
    const third = queue.enqueue(async () => {
      started.push('third');
    });
    const results = await Promise.allSettled([first, second, third]);
    expect(results[0]).toEqual({ status: 'rejected', reason: failure });
    const skipped = {
      status: 'rejected',
      reason: {
        name: 'WriteNotSentError',
        message: 'An earlier change failed, so this one was not sent.',
        cause: failure,
      },
    };
    expect(results[1]).toMatchObject(skipped);
    expect(results[2]).toMatchObject(skipped);
    expect(started).toEqual([]);
    expect(await queue.enqueue(async () => 'explicit retry')).toBe(
      'explicit retry',
    );
  });

  it('isolates different owners and scopes while sharing equivalent keys', async () => {
    const queues = createScopedWriteQueues();
    const first = {};
    const second = {};
    const failure = new Error('First worktree failed');
    const failed = queues(first, ['comments', 'tree-one']).enqueue(() =>
      Promise.reject(failure),
    );
    const blocked = queues(first, ['comments', 'tree-one']).enqueue(
      async () => 'should not run',
    );
    const otherTree = queues(first, ['comments', 'tree-two']).enqueue(
      async () => 'other tree',
    );
    const otherOwner = queues(second, ['comments', 'tree-one']).enqueue(
      async () => 'other connection',
    );
    const results = await Promise.allSettled([
      failed,
      blocked,
      otherTree,
      otherOwner,
    ]);
    expect(results[0]).toEqual({ status: 'rejected', reason: failure });
    expect(results[1]).toMatchObject({
      status: 'rejected',
      reason: {
        message: 'An earlier change failed, so this one was not sent.',
        cause: failure,
      },
    });
    expect(results.slice(2)).toEqual([
      { status: 'fulfilled', value: 'other tree' },
      { status: 'fulfilled', value: 'other connection' },
    ]);
  });

  it('reports a drain once after the last queued write settles', async () => {
    let drains = 0;
    const queue = createWriteQueue(() => {
      drains += 1;
    });
    const first = queue.enqueue(async () => 'saved');
    const second = queue.enqueue(() => Promise.reject(new Error('Refused')));
    await first;
    expect(drains).toBe(0);
    await expect(second).rejects.toThrow('Refused');
    expect(drains).toBe(1);
    await queue.enqueue(async () => 'retry');
    expect(drains).toBe(2);
  });

  it('serializes retained scope handles after their earlier queue drains', async () => {
    const queues = createScopedWriteQueues();
    const owner = {};
    const retained = queues(owner, ['comments', 'tree']);
    await retained.enqueue(async () => 'initial write');
    const reopened = queues(owner, ['comments', 'tree']);
    const steps: string[] = [];
    let finish = () => {};
    const gate = new Promise<void>((resolve) => {
      finish = resolve;
    });
    const first = retained.enqueue(async () => {
      steps.push('retained started');
      await gate;
      steps.push('retained finished');
    });
    const second = reopened.enqueue(async () => {
      steps.push('reopened started');
    });
    await Promise.resolve();
    expect(steps).toEqual(['retained started']);
    finish();
    await Promise.all([first, second]);
    expect(steps).toEqual([
      'retained started',
      'retained finished',
      'reopened started',
    ]);
  });
});
