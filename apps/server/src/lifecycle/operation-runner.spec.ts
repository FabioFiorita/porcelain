import { AsyncLocalStorage } from 'node:async_hooks';
import { subscribe, unsubscribe } from 'node:diagnostics_channel';
import { describe, expect, it, onTestFinished } from 'vitest';
import { ApplicationClosedError } from './errors/application-closed-error.ts';
import { type OperationEvent, OperationRunner } from './operation-runner.ts';

describe('OperationRunner', () => {
  it('aborts active work, rejects queued and new work, and releases resources once', async () => {
    let releases = 0;
    let queuedRan = false;
    const started = Promise.withResolvers<void>();
    const runner = new OperationRunner(() => {
      releases++;
    }, 30_000);
    const active = runner.run(async (signal) => {
      started.resolve();
      await new Promise<void>((resolve) =>
        signal.addEventListener(
          'abort',
          () => {
            void runner.close();
            resolve();
          },
          { once: true },
        ),
      );
      signal.throwIfAborted();
    });
    const activeFailure = expect(active).rejects.toBeInstanceOf(
      ApplicationClosedError,
    );
    await started.promise;
    const queued = runner.run(async () => {
      queuedRan = true;
    });
    const queuedFailure = expect(queued).rejects.toBeInstanceOf(
      ApplicationClosedError,
    );
    const closing = runner.close();
    await Promise.all([activeFailure, queuedFailure, closing, runner.close()]);
    await expect(runner.run(async () => {})).rejects.toBeInstanceOf(
      ApplicationClosedError,
    );
    expect(() => runner.assertOpen()).toThrow(ApplicationClosedError);
    expect(queuedRan).toBe(false);
    expect(releases).toBe(1);
  });

  it('cancels queued work without executing it or poisoning later operations', async () => {
    const release = Promise.withResolvers<void>();
    const started = Promise.withResolvers<void>();
    const runner = new OperationRunner(() => {}, 30_000);
    const active = runner.run(async () => {
      started.resolve();
      await release.promise;
    });
    await started.promise;
    const controller = new AbortController();
    let writes = 0;
    const queued = runner.run(async () => {
      writes++;
    }, controller.signal);
    const rejected = expect(queued).rejects.toMatchObject({
      name: 'AbortError',
    });
    controller.abort();
    await rejected;
    release.resolve();
    await active;
    await runner.run(async () => {
      writes++;
    });
    await runner.close();
    expect(writes).toBe(1);
  });

  it('bounds the entire operation and remains usable after a timeout', async () => {
    const runner = new OperationRunner(() => {}, 20);
    // Keep the event loop alive: AbortSignal.timeout intentionally uses an unref timer.
    const keepAlive = setInterval(() => {}, 1_000);
    try {
      await expect(
        runner.run(async (signal) => {
          await new Promise<void>((resolve) =>
            signal.addEventListener('abort', () => resolve(), { once: true }),
          );
          signal.throwIfAborted();
        }),
      ).rejects.toMatchObject({ name: 'TimeoutError' });
      await expect(runner.run(async () => 'healthy')).resolves.toBe('healthy');
    } finally {
      clearInterval(keepAlive);
      await runner.close();
    }
  });

  // Development tooling subscribes by channel name and attributes each event to
  // the request that queued the work through its async context.
  const observe = () => {
    const events: (OperationEvent & { request: string | undefined })[] = [];
    const listener = (event: unknown) =>
      events.push({
        ...(event as OperationEvent),
        request: context.getStore(),
      });
    subscribe('porcelain:operation', listener);
    onTestFinished(() => {
      unsubscribe('porcelain:operation', listener);
    });
    const outcome = (operation: number | undefined) =>
      events
        .filter((event) => event.operation === operation)
        .map(({ phase, failed }) => (failed ? `${phase}:failed` : phase));
    const operations = () => [
      ...new Set(events.map(({ operation }) => operation)),
    ];
    return { events, outcome, operations };
  };
  const context = new AsyncLocalStorage<string>();

  it('publishes queue waits and outcomes per named runner while subscribed', async () => {
    const { events, outcome, operations } = observe();
    const started = Promise.withResolvers<void>();
    const release = Promise.withResolvers<void>();
    const runner = new OperationRunner(() => {}, 30_000, 'summaries');
    const first = runner.run(async () => {
      started.resolve();
      await release.promise;
    });
    const second = runner.run(async () => {
      throw new Error('failed');
    });
    const owned = runner.runOwned(async () => 'written', 30_000);
    await started.promise;
    // Later work waits behind the first operation instead of starting.
    expect(events.map(({ phase }) => phase)).toEqual([
      'queued',
      'queued',
      'queued',
      'started',
    ]);
    release.resolve();
    await first;
    await expect(second).rejects.toThrow('failed');
    await owned;
    await runner.close();
    const [firstId, secondId, ownedId] = operations();
    expect(new Set(events.map(({ runner }) => runner))).toEqual(
      new Set(['summaries']),
    );
    expect(outcome(firstId)).toEqual(['queued', 'started', 'settled']);
    expect(outcome(secondId)).toEqual(['queued', 'started', 'settled:failed']);
    expect(outcome(ownedId)).toEqual(['queued', 'started', 'settled']);
  });

  it('reports work cancelled while queued as settled without starting', async () => {
    const { outcome, operations } = observe();
    const started = Promise.withResolvers<void>();
    const release = Promise.withResolvers<void>();
    const runner = new OperationRunner(() => {}, 30_000, 'operations');
    const active = runner.run(async () => {
      started.resolve();
      await release.promise;
    });
    await started.promise;
    const controller = new AbortController();
    const queued = runner.run(async () => {}, controller.signal);
    const rejected = expect(queued).rejects.toMatchObject({
      name: 'AbortError',
    });
    controller.abort();
    await rejected;
    release.resolve();
    await active;
    await runner.close();
    const [, queuedId] = operations();
    expect(outcome(queuedId)).toEqual(['queued', 'settled:failed']);
  });

  it('publishes each event in the async context of the request that queued it', async () => {
    const { events } = observe();
    const started = Promise.withResolvers<void>();
    const release = Promise.withResolvers<void>();
    const runner = new OperationRunner(() => {}, 30_000, 'operations');
    const first = context.run('request A', () =>
      runner.run(async () => {
        started.resolve();
        await release.promise;
      }),
    );
    await started.promise;
    // B starts only when A finishes, yet its events still belong to B.
    const second = context.run('request B', () => runner.run(async () => {}));
    release.resolve();
    await Promise.all([first, second]);
    await runner.close();
    expect(events.map(({ phase, request }) => `${request}:${phase}`)).toEqual([
      'request A:queued',
      'request A:started',
      'request B:queued',
      'request A:settled',
      'request B:started',
      'request B:settled',
    ]);
  });

  it('keeps owned receipt finalization inside shutdown and the shared queue', async () => {
    const started = Promise.withResolvers<void>();
    const finish = Promise.withResolvers<void>();
    const events: string[] = [];
    const runner = new OperationRunner(() => events.push('closed'), 30_000);
    const active = runner.runOwned(async (signal) => {
      started.resolve();
      await finish.promise;
      expect(signal.aborted).toBe(true);
      events.push('receipt');
    }, 120_000);
    await started.promise;
    const queued = runner.runOwned(async (signal) => {
      expect(signal.aborted).toBe(true);
      events.push('queued-rejection-receipt');
    }, 120_000);
    const closing = runner.close();
    expect(events).toEqual([]);
    finish.resolve();
    await Promise.all([active, queued, closing]);
    expect(events).toEqual(['receipt', 'queued-rejection-receipt', 'closed']);
  });
});
