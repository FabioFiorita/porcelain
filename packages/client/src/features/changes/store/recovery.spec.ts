import { Effect } from 'effect';
import { expect, it } from 'vitest';
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

it('keeps the newer recovery pending when an older observation finishes', () => {
  const result = Effect.runSync(
    Effect.gen(function* () {
      const recovery = yield* ChangedDiffRecovery;
      yield* recovery.begin('worktree/path', 'observation-1');
      const accepted = yield* recovery.begin('worktree/path', 'observation-2');
      yield* recovery.finish('worktree/path', 'observation-1');
      return { accepted, pending: (yield* recovery.state).pending };
    }).pipe(Effect.provide(ChangedDiffRecovery.layer)),
  );
  expect(result).toEqual({
    accepted: true,
    pending: { 'worktree/path': 'observation-2' },
  });
});

it('recovers different file observations independently', () => {
  const result = Effect.runSync(
    Effect.gen(function* () {
      const recovery = yield* ChangedDiffRecovery;
      yield* recovery.begin('first/path', 'observation');
      const accepted = yield* recovery.begin('second/path', 'observation');
      yield* recovery.finish('first/path', 'observation');
      return { accepted, pending: (yield* recovery.state).pending };
    }).pipe(Effect.provide(ChangedDiffRecovery.layer)),
  );
  expect(result).toEqual({
    accepted: true,
    pending: { 'second/path': 'observation' },
  });
});
