import { Effect } from 'effect';
import { NoWorktreeAtPathError } from '../errors/no-worktree-at-path-error.ts';
import type {
  FindWorktreeAtPathInput,
  FindWorktreeAtPathResult,
} from '../models/find-worktree-at-path.ts';
import { worktreeAtPath } from '../rules/worktree-at-path.ts';

export class FindWorktreeAtPathService {
  execute(
    input: FindWorktreeAtPathInput,
  ): Effect.Effect<FindWorktreeAtPathResult, NoWorktreeAtPathError> {
    return Effect.gen({ self: this }, function* () {
      const worktreeId = worktreeAtPath(input.path, input.listings);
      if (worktreeId === undefined)
        return yield* Effect.fail(new NoWorktreeAtPathError());
      return { worktreeId };
    });
  }
}
