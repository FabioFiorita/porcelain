import type { Context } from 'effect';
import { Effect, Exit } from 'effect';
import { describe, expect, it } from 'vitest';
import {
  WorktreeRead,
  WorktreeWrite,
  nativeRead,
  nativeWrite,
  withReadLease,
  withWriteLease,
} from './worktree-lease.ts';

describe('admitted worktree IO', () => {
  it('refuses IO for another worktree before touching the native adapter', async () => {
    let calls = 0;
    const exit = await Effect.runPromiseExit(
      withReadLease(
        'admitted',
        nativeRead('another', () => {
          calls += 1;
          return Promise.resolve('text');
        }),
      ),
    );
    expect(Exit.hasDies(exit)).toBe(true);
    expect(calls).toBe(0);
  });

  it('refuses an escaped read capability after admission has ended', async () => {
    const lease = await Effect.runPromise(
      withReadLease('worktree', WorktreeRead),
    );
    let calls = 0;
    const exit = await Effect.runPromiseExit(
      nativeRead('worktree', () => {
        calls += 1;
        return Promise.resolve('text');
      }).pipe(Effect.provideService(WorktreeRead, lease)),
    );
    expect(Exit.hasDies(exit)).toBe(true);
    expect(calls).toBe(0);
  });

  it('admits reads and writes together only within the write lifetime', async () => {
    const calls: string[] = [];
    const lease = await Effect.runPromise(
      withWriteLease(
        'worktree',
        Effect.gen(function* () {
          yield* nativeRead('worktree', () => {
            calls.push('read');
            return Promise.resolve('before');
          });
          yield* nativeWrite('worktree', () => {
            calls.push('write');
            return Promise.resolve();
          });
          return yield* WorktreeWrite;
        }),
      ),
    );
    expect(calls).toEqual(['read', 'write']);
    const escaped = await Effect.runPromiseExit(
      nativeWrite('worktree', () => {
        calls.push('escaped');
        return Promise.resolve();
      }).pipe(Effect.provideService(WorktreeWrite, lease)),
    );
    expect(Exit.hasDies(escaped)).toBe(true);
    expect(calls).toEqual(['read', 'write']);
  });

  it('keeps the lease active until interrupted native cleanup actually settles', async () => {
    const started =
      Promise.withResolvers<Context.Service.Shape<typeof WorktreeRead>>();
    const aborted = Promise.withResolvers<void>();
    const native = Promise.withResolvers<string>();
    const controller = new AbortController();
    const running = Effect.runPromiseExit(
      withReadLease(
        'worktree',
        Effect.gen(function* () {
          const lease = yield* WorktreeRead;
          return yield* nativeRead('worktree', (signal) => {
            signal.addEventListener('abort', () => aborted.resolve(), {
              once: true,
            });
            started.resolve(lease);
            return native.promise;
          });
        }),
      ),
      { signal: controller.signal },
    );
    const lease = await started.promise;
    controller.abort();
    await aborted.promise;
    expect(() => lease.assert('worktree')).not.toThrow();
    native.resolve('finished');
    expect(Exit.hasInterrupts(await running)).toBe(true);
    expect(() => lease.assert('worktree')).toThrow('current admitted lease');
  });
});

it('refuses an escaped commit confirmation after the write lease has closed', async () => {
  let confirmations = 0;
  const escaped = await Effect.runPromise(
    withWriteLease(
      'worktree',
      nativeWrite('worktree', (_signal, committed) =>
        Promise.resolve(committed),
      ),
      () => {
        confirmations += 1;
      },
    ),
  );
  expect(escaped).toBeTypeOf('function');
  expect(escaped).toThrow('current admitted lease');
  expect(confirmations).toBe(0);
});
