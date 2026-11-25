import { admittedRead } from '@porcelain/effects';
import { Effect, type Scope } from 'effect';
import {
  listedWorktreeEffect,
  type ListedWorktrees,
} from '../projects/checkout-session.ts';
import {
  readFailure,
  type CheckoutPath,
  type GuardedPathFailure,
} from './inspect-path.ts';

export function readGuardedWorktree<A>(
  worktrees: ListedWorktrees,
  input: { worktreeId: string; path: string },
  read: (
    target: CheckoutPath,
  ) => Effect.Effect<A, GuardedPathFailure, Scope.Scope>,
) {
  return withGuardedWorktree(worktrees, input, (target) =>
    Effect.scoped(read(target)),
  );
}

export function withGuardedWorktree<A>(
  worktrees: ListedWorktrees,
  input: { worktreeId: string; path: string },
  read: (target: CheckoutPath) => Effect.Effect<A, GuardedPathFailure>,
) {
  return admittedRead(
    input.worktreeId,
    Effect.gen(function* () {
      const checkout = yield* listedWorktreeEffect(
        worktrees,
        input.worktreeId,
      ).pipe(Effect.orDie);
      return yield* read({ root: checkout.path, path: input.path }).pipe(
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
