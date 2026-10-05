import { describe, expect, it } from 'vitest';
import { Effect, Exit } from 'effect';
import { nativeOperation } from '@porcelain/effects';
import { withSignal } from './with-signal.ts';

describe('signal boundary', () => {
  it('does not start work for an already closed caller', async () => {
    const controller = new AbortController();
    controller.abort();
    let started = false;
    const exit = await Effect.runPromiseExit(
      withSignal(
        Effect.sync(() => {
          started = true;
        }),
        controller.signal,
      ),
    );
    expect(Exit.hasInterrupts(exit)).toBe(true);
    expect(started).toBe(false);
  });

  it('interrupts native work and holds resource release until its cleanup settles', async () => {
    const controller = new AbortController();
    const started = Promise.withResolvers<void>();
    const aborted = Promise.withResolvers<void>();
    const native = Promise.withResolvers<string>();
    let released = false;
    const running = Effect.runPromiseExit(
      withSignal(
        nativeOperation((signal) => {
          signal.addEventListener('abort', () => aborted.resolve(), {
            once: true,
          });
          started.resolve();
          return native.promise;
        }).pipe(
          Effect.ensuring(
            Effect.sync(() => {
              released = true;
            }),
          ),
        ),
        controller.signal,
      ),
    );
    await started.promise;
    controller.abort();
    await aborted.promise;
    expect(released).toBe(false);
    native.resolve('settled');
    expect(Exit.hasInterrupts(await running)).toBe(true);
    expect(released).toBe(true);
  });

  it('preserves declared failures', async () => {
    const failure = { _tag: 'Conflict' } as const;
    const exit = await Effect.runPromiseExit(
      withSignal(Effect.fail(failure), new AbortController().signal),
    );
    expect(exit).toEqual(Exit.fail(failure));
  });
});
