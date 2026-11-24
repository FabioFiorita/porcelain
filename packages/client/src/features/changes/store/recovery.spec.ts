import { Effect } from 'effect';
import { expect, it } from 'vite-plus/test';
import { ChangedDiffRecovery } from './recovery.ts';

const run = <A>(work: Effect.Effect<A, never, ChangedDiffRecovery>) =>
  Effect.runSync(work.pipe(Effect.provide(ChangedDiffRecovery.layer)));

it('starts one refresh at a time, and a refresh covers every Changes read received before it started', () => {
  const result = run(
    Effect.gen(function* () {
      const recovery = yield* ChangedDiffRecovery;
      const first = yield* recovery.stamp('worktree');
      const second = yield* recovery.stamp('worktree');
      const started = yield* recovery.begin('worktree', first);
      const whilePending = yield* recovery.begin('worktree', second);
      yield* recovery.finish('worktree');
      const covered = yield* recovery.begin('worktree', second);
      const later = yield* recovery.stamp('worktree');
      const fromLater = yield* recovery.begin('worktree', later);
      return {
        reads: [first, second, later],
        started,
        whilePending,
        covered,
        fromLater,
      };
    }),
  );
  expect(result).toEqual({
    reads: [1, 2, 3],
    started: true,
    whilePending: false,
    covered: false,
    fromLater: true,
  });
});

it('counts Changes reads and refreshes for each worktree on its own', () => {
  const result = run(
    Effect.gen(function* () {
      const recovery = yield* ChangedDiffRecovery;
      const first = yield* recovery.stamp('first');
      yield* recovery.begin('first', first);
      const other = yield* recovery.stamp('second');
      return { other, started: yield* recovery.begin('second', other) };
    }),
  );
  expect(result).toEqual({ other: 1, started: true });
});
