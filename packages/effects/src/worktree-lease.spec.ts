import { Effect, Exit, Deferred, Fiber } from 'effect';
import { describe, expect, it } from '@effect/vitest';
import {
  WorktreeRead,
  WorktreeWrite,
  admittedRead,
  admittedWrite,
  withReadLease,
  withWriteLease,
} from './worktree-lease.ts';

describe('admitted worktree IO', () => {
  it.effect('refuses IO for another worktree before touching the adapter', () =>
    Effect.gen(function* () {
      let calls = 0;
      const exit = yield* Effect.exit(
        withReadLease(
          'admitted',
          admittedRead(
            'another',
            Effect.sync(() => {
              calls += 1;
              return 'text';
            }),
          ),
        ),
      );
      expect(Exit.hasDies(exit)).toBe(true);
      expect(calls).toBe(0);
    }),
  );
  it.effect(
    'refuses an escaped read capability after admission has ended',
    () =>
      Effect.gen(function* () {
        const lease = yield* withReadLease('worktree', WorktreeRead);
        let calls = 0;
        const exit = yield* Effect.exit(
          admittedRead(
            'worktree',
            Effect.sync(() => {
              calls += 1;
              return 'text';
            }),
          ).pipe(Effect.provideService(WorktreeRead, lease)),
        );
        expect(Exit.hasDies(exit)).toBe(true);
        expect(calls).toBe(0);
      }),
  );
  it.effect(
    'admits reads and writes together only within the write lifetime',
    () =>
      Effect.gen(function* () {
        const calls: string[] = [];
        const lease = yield* withWriteLease(
          'worktree',
          Effect.gen(function* () {
            yield* admittedRead(
              'worktree',
              Effect.sync(() => {
                calls.push('read');
                return 'before';
              }),
            );
            yield* admittedWrite('worktree', () =>
              Effect.sync(() => {
                calls.push('write');
              }),
            );
            return yield* WorktreeWrite;
          }),
        );
        expect(calls).toEqual(['read', 'write']);
        const escaped = yield* Effect.exit(
          admittedWrite('worktree', () =>
            Effect.sync(() => {
              calls.push('escaped');
            }),
          ).pipe(Effect.provideService(WorktreeWrite, lease)),
        );
        expect(Exit.hasDies(escaped)).toBe(true);
        expect(calls).toEqual(['read', 'write']);
      }),
  );
  it.effect('keeps the lease active until interrupted cleanup settles', () =>
    Effect.gen(function* () {
      const started =
        yield* Deferred.make<Effect.Success<typeof WorktreeRead>>();
      const interrupted = yield* Deferred.make<void>();
      const cleanup = yield* Deferred.make<void>();
      const running = yield* Effect.forkChild(
        withReadLease(
          'worktree',
          Effect.gen(function* () {
            const lease = yield* WorktreeRead;
            yield* Deferred.succeed(started, lease);
            return yield* Effect.never.pipe(
              Effect.ensuring(
                Deferred.succeed(interrupted, undefined).pipe(
                  Effect.andThen(Deferred.await(cleanup)),
                ),
              ),
            );
          }),
        ),
      );
      const lease = yield* Deferred.await(started);
      const stopping = yield* Effect.forkChild(Fiber.interrupt(running));
      yield* Deferred.await(interrupted);
      expect(() => lease.assert('worktree')).not.toThrow();
      yield* Deferred.succeed(cleanup, undefined);
      yield* Fiber.join(stopping);
      expect(Exit.hasInterrupts(yield* Fiber.await(running))).toBe(true);
      expect(() => lease.assert('worktree')).toThrow('current admitted lease');
    }),
  );
});
it.effect(
  'refuses an escaped commit confirmation after the write lease has closed',
  () =>
    Effect.gen(function* () {
      let confirmations = 0;
      const escaped = yield* withWriteLease(
        'worktree',
        admittedWrite('worktree', (committed) => Effect.succeed(committed)),
        () => {
          confirmations += 1;
        },
      );
      expect(escaped).toBeTypeOf('function');
      expect(escaped).toThrow('current admitted lease');
      expect(confirmations).toBe(0);
    }),
);
