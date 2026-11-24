import { Effect, Stream } from 'effect';
import { expect, it } from 'vite-plus/test';
import { ChangedDiffRecovery, worktreeRecovery } from './recovery.ts';

const run = <A>(work: Effect.Effect<A, never, ChangedDiffRecovery>) =>
  Effect.runSync(work.pipe(Effect.provide(ChangedDiffRecovery.layer)));
const snapshot = { statusToken: 'a', fingerprints: new Map() };

it('keeps one recovery per worktree: a single refresh at a time, with its produced read and retries', () => {
  const result = run(
    Effect.gen(function* () {
      const recovery = yield* ChangedDiffRecovery;
      const read = yield* recovery.stamp('worktree', snapshot);
      const started = yield* recovery.begin('worktree', read);
      const twice = yield* recovery.begin('worktree', read);
      yield* recovery.stamp('worktree', snapshot);
      yield* recovery.produced('worktree');
      yield* recovery.finish('worktree');
      const ticket = { generation: 1, read: 2 };
      const first = yield* recovery.retry('worktree', ticket, ['batch']);
      const again = yield* recovery.retry('worktree', ticket, ['batch']);
      yield* recovery.settle('worktree', ticket, 'batch');
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
    snapshot,
    generation: 1,
    running: false,
    coveredThrough: 1,
    produced: [2],
    retried: ['batch'],
    inFlight: [],
  });
});

it('does not spend a retry authorized by one recovery once the next has begun', () => {
  const result = run(
    Effect.gen(function* () {
      const recovery = yield* ChangedDiffRecovery;
      yield* recovery.begin(
        'worktree',
        yield* recovery.stamp('worktree', snapshot),
      );
      yield* recovery.stamp('worktree', snapshot);
      yield* recovery.finish('worktree');
      const authorized = { generation: 1, read: 2 };
      yield* recovery.begin(
        'worktree',
        yield* recovery.stamp('worktree', snapshot),
      );
      const during = yield* recovery.retry('worktree', authorized, ['batch']);
      yield* recovery.stamp('worktree', snapshot);
      yield* recovery.finish('worktree');
      const after = yield* recovery.retry('worktree', authorized, ['batch']);
      const renewed = yield* recovery.retry(
        'worktree',
        { generation: 2, read: 4 },
        ['batch'],
      );
      return { during, after, renewed };
    }),
  );
  expect(result).toEqual({ during: [], after: [], renewed: ['batch'] });
});
