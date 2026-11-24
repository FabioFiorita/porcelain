import { Effect } from 'effect';
import { expect, it } from 'vite-plus/test';
import { ChangedDiffRecovery } from './recovery.ts';

it('attempts recovery only once for an observation, even after it finishes', () => {
  const result = Effect.runSync(
    Effect.gen(function* () {
      const recovery = yield* ChangedDiffRecovery;
      const first = yield* recovery.begin('worktree/path', 'observation-1');
      const duplicate = yield* recovery.begin('worktree/path', 'observation-1');
      yield* recovery.finish('worktree/path', 'observation-1');
      const repeated = yield* recovery.begin('worktree/path', 'observation-1');
      return {
        first,
        duplicate,
        repeated,
        pending: (yield* recovery.state).pending,
      };
    }).pipe(Effect.provide(ChangedDiffRecovery.layer)),
  );
  expect(result).toEqual({
    first: true,
    duplicate: false,
    repeated: false,
    pending: {},
  });
});

it.each([
  {
    firstPath: 'worktree/path',
    firstObservation: 'observation-1',
    nextPath: 'worktree/path',
    nextObservation: 'observation-2',
    pending: { 'worktree/path': ['observation-2'] },
  },
  {
    firstPath: 'first/path',
    firstObservation: 'observation',
    nextPath: 'second/path',
    nextObservation: 'observation',
    pending: { 'second/path': ['observation'] },
  },
])(
  'finishing $firstPath at $firstObservation retains $nextPath at $nextObservation',
  ({ firstPath, firstObservation, nextPath, nextObservation, pending }) => {
    const result = Effect.runSync(
      Effect.gen(function* () {
        const recovery = yield* ChangedDiffRecovery;
        yield* recovery.begin(firstPath, firstObservation);
        const accepted = yield* recovery.begin(nextPath, nextObservation);
        yield* recovery.finish(firstPath, firstObservation);
        return { accepted, pending: (yield* recovery.state).pending };
      }).pipe(Effect.provide(ChangedDiffRecovery.layer)),
    );
    expect(result).toEqual({ accepted: true, pending });
  },
);

it('does not attempt an observation again after another observation of the same worktree began', () => {
  const result = Effect.runSync(
    Effect.gen(function* () {
      const recovery = yield* ChangedDiffRecovery;
      yield* recovery.begin('worktree/path', 'observation-1');
      yield* recovery.begin('worktree/path', 'observation-2');
      return yield* recovery.begin('worktree/path', 'observation-1');
    }).pipe(Effect.provide(ChangedDiffRecovery.layer)),
  );
  expect(result).toBe(false);
});
