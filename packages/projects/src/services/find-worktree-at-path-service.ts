import { Effect, Context, Layer } from 'effect';
import { NoWorktreeAtPathError } from '../errors/no-worktree-at-path-error.ts';
import {
  type FindWorktreeAtPathInput,
  type FindWorktreeAtPathResult,
} from '../models/find-worktree-at-path.ts';
import { worktreeAtPath } from '../rules/worktree-at-path.ts';

export class FindWorktreeAtPathService extends Context.Service<
  FindWorktreeAtPathService,
  {
    readonly execute: (
      input: FindWorktreeAtPathInput,
    ) => Effect.Effect<FindWorktreeAtPathResult, NoWorktreeAtPathError>;
  }
>()('@porcelain/projects/FindWorktreeAtPathService') {
  static readonly layer = Layer.effect(
    FindWorktreeAtPathService,
    Effect.sync(() => {
      return {
        execute: Effect.fn('FindWorktreeAtPathService.execute')(function* (
          input: FindWorktreeAtPathInput,
        ): Effect.fn.Return<FindWorktreeAtPathResult, NoWorktreeAtPathError> {
          const worktreeId = worktreeAtPath(input.path, input.listings);
          if (worktreeId === undefined)
            return yield* Effect.fail(new NoWorktreeAtPathError());
          return { worktreeId };
        }),
      };
    }),
  );
}
