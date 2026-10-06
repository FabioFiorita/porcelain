import { describe, expect, it } from 'vitest';
import { Cause, Effect, Exit } from 'effect';
import { releaseInOrder } from './release-in-order.ts';

describe('ordered resource release', () => {
  it('waits for one stage before releasing its dependencies', async () => {
    const gate = Promise.withResolvers<void>();
    const started = Promise.withResolvers<void>();
    const order: string[] = [];
    const released = Effect.runPromise(
      releaseInOrder([
        Effect.promise(async () => {
          order.push('listener');
          started.resolve();
          await gate.promise;
          order.push('drained');
        }),
        Effect.sync(() => {
          order.push('workers');
        }),
        Effect.sync(() => {
          order.push('database');
        }),
      ]),
    );
    await started.promise;
    expect(order).toEqual(['listener']);
    gate.resolve();
    await released;
    expect(order).toEqual(['listener', 'drained', 'workers', 'database']);
  });

  it('releases later resources after faults and retains the first fault', async () => {
    const first = new Error('Listener failed');
    const second = new Error('Workers failed');
    let closed = false;
    const exit = await Effect.runPromiseExit(
      releaseInOrder([
        Effect.die(first),
        Effect.die(second),
        Effect.sync(() => {
          closed = true;
        }),
      ]),
    );
    expect(closed).toBe(true);
    expect(Exit.isFailure(exit) && Cause.squash(exit.cause)).toBe(first);
  });
});
