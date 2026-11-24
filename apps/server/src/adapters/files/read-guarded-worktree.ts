import { admittedRead } from '@porcelain/effects';
import { Effect, type Scope } from 'effect';
import {
  listedWorktreeEffect,
  type ListedWorktrees,
} from '../projects/checkout-session.ts';
import { readFailure, type GuardedPathFailure } from './inspect-path.ts';

export function readGuardedWorktree<A>(
  worktrees: ListedWorktrees,
  input: { worktreeId: string; path: string },
  read: (target: {
    root: string;
    path: string;
  }) => Effect.Effect<A, GuardedPathFailure, Scope.Scope>,
) {
  return admittedRead(
    input.worktreeId,
    Effect.gen(function* () {
      const checkout = yield* listedWorktreeEffect(
        worktrees,
        input.worktreeId,
      ).pipe(Effect.orDie);
      return yield* Effect.scoped(
        read({ root: checkout.path, path: input.path }),
      ).pipe(
        Effect.catch((error) => {
          const failure = readFailure(error);
          return failure === undefined
            ? Effect.die(error)
            : Effect.succeed({ kind: 'failed' as const, failure });
        }),
      );
    }),
  );
}
