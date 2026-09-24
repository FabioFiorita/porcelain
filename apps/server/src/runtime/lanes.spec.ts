import { describe, expect, it } from 'vitest';
import { Lanes } from './lanes.ts';

function lanes() {
  return new Lanes({ deadlineMs: 1000 });
}

describe('Lanes', () => {
  it('runs background work in its lane after the write that holds the lane', async () => {
    const subject = lanes();
    const order: string[] = [];
    const holding = Promise.withResolvers<void>();
    const write = subject.run('repository', 'write', async () => {
      await holding.promise;
      order.push('write');
    });
    subject.background(
      'repository',
      async () => {
        order.push('background');
      },
      { onFailure: () => order.push('failed') },
    );
    holding.resolve();
    await write;
    await subject.close();
    expect(order).toEqual(['write', 'background']);
  });

  it('hands a failed background work to its failure handler once, and closing waits for both', async () => {
    const subject = lanes();
    const failures: unknown[] = [];
    const cause = new Error('Git failed');
    subject.background(
      'repository',
      async () => {
        throw cause;
      },
      { onFailure: (error) => failures.push(error) },
    );
    await subject.close();
    expect(failures).toEqual([cause]);
  });

  it('hands background work past its deadline to the failure handler', async () => {
    const subject = lanes();
    const failed = Promise.withResolvers<unknown>();
    subject.background(
      'repository',
      ({ signal }) =>
        new Promise<void>((_resolve, reject) =>
          signal.addEventListener('abort', () => reject(signal.reason)),
        ),
      { deadlineMs: 5, onFailure: (error) => failed.resolve(error) },
    );
    expect(await failed.promise).toBeInstanceOf(DOMException);
    await subject.close();
  });
});
