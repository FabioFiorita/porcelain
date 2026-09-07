import { expect, it } from 'vitest';
import { ApplicationClosedError } from './errors/application-closed-error.ts';
import { OperationRunner } from './operation-runner.ts';

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
  const rejected = expect(queued).rejects.toMatchObject({ name: 'AbortError' });
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
