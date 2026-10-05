import { describe, expect, it } from 'vitest';
import { Effect, Exit } from 'effect';
import { nativeOperation } from './native-operation.ts';

describe('native operation ownership', () => {
  it('aborts native IO but holds release until its cleanup settles', async () => {
    const started = Promise.withResolvers<void>();
    const aborted = Promise.withResolvers<void>();
    const native = Promise.withResolvers<string>();
    const controller = new AbortController();
    let released = 0;
    const result = Effect.runPromiseExit(
      nativeOperation((signal) => {
        signal.addEventListener('abort', () => aborted.resolve(), {
          once: true,
        });
        started.resolve();
        return native.promise;
      }).pipe(
        Effect.ensuring(
          Effect.sync(() => {
            released += 1;
          }),
        ),
      ),
      { signal: controller.signal },
    );
    await started.promise;
    controller.abort();
    await aborted.promise;
    expect(released).toBe(0);
    native.resolve('finished');
    expect(Exit.hasInterrupts(await result)).toBe(true);
    expect(released).toBe(1);
  });

  it('preserves successful native values', async () => {
    await expect(
      Effect.runPromise(nativeOperation(() => Promise.resolve('saved'))),
    ).resolves.toBe('saved');
  });

  it('settles rejected native work before release after cancellation', async () => {
    const started = Promise.withResolvers<void>();
    const aborted = Promise.withResolvers<void>();
    const native = Promise.withResolvers<string>();
    const controller = new AbortController();
    let released = 0;
    const result = Effect.runPromiseExit(
      nativeOperation((signal) => {
        signal.addEventListener('abort', () => aborted.resolve(), {
          once: true,
        });
        started.resolve();
        return native.promise;
      }).pipe(
        Effect.ensuring(
          Effect.sync(() => {
            released += 1;
          }),
        ),
      ),
      { signal: controller.signal },
    );
    await started.promise;
    controller.abort();
    await aborted.promise;
    expect(released).toBe(0);
    native.reject(new Error('Native cleanup failed'));
    expect(Exit.hasInterrupts(await result)).toBe(true);
    expect(released).toBe(1);
  });
});
