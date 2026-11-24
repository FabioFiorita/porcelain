import { Effect, Stream } from 'effect';
import { expect, it } from 'vite-plus/test';
import { ChangedDiffRecovery, worktreeRecovery } from './recovery.ts';

const run = <A>(work: Effect.Effect<A, never, ChangedDiffRecovery>) =>
  Effect.runSync(work.pipe(Effect.provide(ChangedDiffRecovery.layer)));

it('keeps one recovery per worktree: a single refresh at a time, with its produced read and retries', () => {
  const result = run(
    Effect.gen(function* () {
      const recovery = yield* ChangedDiffRecovery;
      const read = yield* recovery.stamp('worktree');
      const started = yield* recovery.begin('worktree', read);
      const twice = yield* recovery.begin('worktree', read);
      yield* recovery.stamp('worktree');
      yield* recovery.produced('worktree');
      yield* recovery.finish('worktree');
      const first = yield* recovery.retry('worktree', ['batch']);
      const again = yield* recovery.retry('worktree', ['batch']);
      const other = yield* recovery.begin('other', 1);
      const state = yield* Stream.runHead(recovery.changes);
      return { started, twice, first, again, other, state };
    }),
  );
  expect(result).toMatchObject({
    started: true,
    twice: false,
    first: ['batch'],
    again: [],
    other: true,
  });
  const state = result.state._tag === 'Some' ? result.state.value : {};
  expect(worktreeRecovery(state, 'worktree')).toEqual({
    latestRead: 2,
    running: false,
    coveredThrough: 1,
    produced: [2],
    retried: ['batch'],
  });
});
